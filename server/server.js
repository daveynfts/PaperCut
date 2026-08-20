"use strict";

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { Redis } = require("@upstash/redis");
const { ethers } = require("ethers");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { isAdminIdentity, normalizeIdentity, optionalAuth, requireAdmin, requireAuth } = require("./auth");
const {
  entitlementTxHash,
  findEntitlementByTxHash,
  normalizeTxHash,
  operationBelongsToUser,
  verifyLegacyCircleTransaction,
} = require("./entitlements");
const { formatUsdc, parseExternalUsdcBalance, parseUsdc } = require("./money");
const { createR2Upload, r2StorageStatus, resolveProtectedAssetUrl } = require("./r2");
const { PaperCutStore } = require("./store");
const { createRetryableInitializer } = require("./retryable-initializer");
const { schemas, validate } = require("./validation");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || "development";
const PAYMENT_MODE = process.env.PAYMENT_MODE || (NODE_ENV === "production" ? "disabled" : "mock");
const isMockMode = PAYMENT_MODE === "mock";
const isLiveMode = PAYMENT_MODE === "live";
const CIRCLE_TERMINAL_FAILURES = new Set(["FAILED", "DENIED", "CANCELLED"]);
const allowedOrigins = new Set(
  String(process.env.CORS_ORIGIN || (NODE_ENV === "production" ? "" : "http://localhost:5173,http://localhost:3000"))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(new Error("Origin is not allowed"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: false,
}));
app.use(express.json({ limit: "100kb", strict: true }));
app.use("/api", rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.API_RATE_LIMIT_PER_MINUTE || 120),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests; please retry shortly" },
}));

function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

const redisClient = createRedisClient();
const store = new PaperCutStore({
  redisClient,
  directory: process.env.PAPERCUT_DATA_DIR || (process.env.VERCEL ? "/tmp" : __dirname),
  seedDirectory: __dirname,
  requireCloud: NODE_ENV === "production" && process.env.ALLOW_FILE_DB_IN_PRODUCTION !== "true",
});

let publisherWalletAddress = "";
let cachedCirclePublicKey = null;
let cachedCirclePublicKeyAt = 0;
const walletInitializationPromises = new Map();

function assertPaymentConfiguration() {
  if (NODE_ENV === "production") {
    const requiredRuntime = ["CORS_ORIGIN", "PRIVY_APP_ID", "PRIVY_APP_SECRET"];
    const missingRuntime = requiredRuntime.filter((name) => !process.env[name]);
    if (missingRuntime.length) {
      throw new Error(`Missing production configuration: ${missingRuntime.join(", ")}`);
    }
  }
  if (!["disabled", "mock", "live"].includes(PAYMENT_MODE)) {
    throw new Error("PAYMENT_MODE must be disabled, mock, or live");
  }
  if (NODE_ENV === "production" && isMockMode && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
    throw new Error("Mock payments are disabled in production");
  }
  if (!isLiveMode) return;
  const required = [
    "CIRCLE_API_KEY",
    "CIRCLE_ENTITY_SECRET",
    "CIRCLE_WALLET_SET_ID",
    "PUBLISHER_WALLET_ID",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing live payment configuration: ${missing.join(", ")}`);
}

async function circleRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(Number(process.env.CIRCLE_REQUEST_TIMEOUT_MS || 8000)),
    headers: {
      Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors) {
    throw new Error(payload.message || `Circle API request failed with HTTP ${response.status}`);
  }
  return payload;
}

async function initializePublisherWallet() {
  if (isMockMode) {
    publisherWalletAddress = process.env.MOCK_PUBLISHER_WALLET || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    return;
  }
  if (!isLiveMode) return;
  const payload = await circleRequest(`https://api.circle.com/v1/w3s/wallets/${process.env.PUBLISHER_WALLET_ID}`);
  const address = payload.data?.wallet?.address;
  if (!address || !ethers.isAddress(address)) throw new Error("Circle publisher wallet has no valid EVM address");
  publisherWalletAddress = address;
}

function encryptEntitySecret(secretHex, publicKeyPem) {
  if (!/^[a-fA-F0-9]{64}$/.test(secretHex || "")) throw new Error("CIRCLE_ENTITY_SECRET must be 32-byte hex");
  return crypto.publicEncrypt({
    key: publicKeyPem,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: "sha256",
  }, Buffer.from(secretHex, "hex")).toString("base64");
}

async function getEntitySecretCiphertext() {
  const now = Date.now();
  if (!cachedCirclePublicKey || now - cachedCirclePublicKeyAt > 30 * 60 * 1000) {
    const payload = await circleRequest("https://api.circle.com/v1/w3s/config/entity/publicKey");
    if (!payload.data?.publicKey) throw new Error("Circle public key was not returned");
    cachedCirclePublicKey = payload.data.publicKey;
    cachedCirclePublicKeyAt = now;
  }
  return encryptEntitySecret(process.env.CIRCLE_ENTITY_SECRET, cachedCirclePublicKey);
}

function stableIdempotencyKey(value) {
  const bytes = Buffer.from(crypto.createHash("sha256").update(String(value)).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function createCircleWallet(idempotencyKey) {
  const payload = await circleRequest("https://api.circle.com/v1/w3s/developer/wallets", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey,
      entitySecretCiphertext: await getEntitySecretCiphertext(),
      walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      blockchains: ["ARC-TESTNET"],
      count: 1,
    }),
  });
  const wallet = payload.data?.wallets?.[0];
  if (!wallet?.id || !ethers.isAddress(wallet.address)) throw new Error("Circle did not create a valid wallet");
  return wallet;
}

async function getWalletUsdcBalance(walletId) {
  if (isMockMode) return null;
  const payload = await circleRequest(`https://api.circle.com/v1/w3s/wallets/${walletId}/balances`);
  const balances = payload.data?.tokenBalances || [];
  const usdc = balances.find((item) => item.token?.symbol === "USDC");
  return formatUsdc(parseExternalUsdcBalance(usdc?.amount || "0"));
}

async function createCircleTransfer({ operationId, sourceWalletId, destinationAddress, amount }) {
  const payload = await circleRequest("https://api.circle.com/v1/w3s/developer/transactions/transfer", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: operationId,
      entitySecretCiphertext: await getEntitySecretCiphertext(),
      walletId: sourceWalletId,
      destinationAddress,
      amounts: [amount],
      blockchain: "ARC-TESTNET",
      feeLevel: "HIGH",
    }),
  });
  if (!payload.data?.id) throw new Error("Circle did not return a transaction ID");
  return payload.data.id;
}

async function getCircleTransaction(transactionId) {
  const payload = await circleRequest(`https://api.circle.com/v1/w3s/transactions/${transactionId}`);
  const transaction = payload.data?.transaction || {};
  return { state: transaction.state || "UNKNOWN", txHash: transaction.txHash || "" };
}

async function getCircleTransactionByHash(txHash) {
  const query = new URLSearchParams({ txHash, pageSize: "10" });
  const payload = await circleRequest(`https://api.circle.com/v1/w3s/transactions?${query}`);
  return (payload.data?.transactions || []).find((transaction) =>
    normalizeTxHash(transaction.txHash) === normalizeTxHash(txHash)
  ) || null;
}

async function pollCircleTransaction(transactionId, attempts = 5) {
  let result = { state: "INITIATED", txHash: "" };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    result = await getCircleTransaction(transactionId);
    if (result.state === "COMPLETE" || CIRCLE_TERMINAL_FAILURES.has(result.state)) return result;
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return result;
}

const ensureStartup = createRetryableInitializer(async () => {
  assertPaymentConfiguration();
  await Promise.all([store.init(), initializePublisherWallet()]);
});

app.use("/api", async (_req, res, next) => {
  try {
    await ensureStartup();
    next();
  } catch (error) {
    res.status(503).json({ error: "Service configuration is incomplete", detail: NODE_ENV === "production" ? undefined : error.message });
  }
});

function generateSnippet(markdown) {
  const clean = String(markdown || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[\s-*+]+(.*?)$/gm, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= 200) return `${clean}${clean.endsWith("...") ? "" : "..."}`;
  return `${clean.slice(0, 197).replace(/\s+\S*$/, "")}...`;
}

function publicPublisherId(key) {
  return `publisher_${crypto.createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

function getPublisherEntryForAuth(publishers, auth) {
  if (!auth) return null;
  if (publishers[auth.accountKey]) return [auth.accountKey, publishers[auth.accountKey]];
  const entry = Object.entries(publishers).find(([, publisher]) => publisher.privyUserId === auth.userId);
  return entry || null;
}

function findPublisherForArticle(publishers, article) {
  if (article.publisherId && publishers[article.publisherId]) return [article.publisherId, publishers[article.publisherId]];
  return Object.entries(publishers).find(([, publisher]) =>
    normalizeIdentity(publisher.name) === normalizeIdentity(article.author)
  ) || null;
}

function isArticleOwner(article, publishers, auth) {
  const publisherEntry = getPublisherEntryForAuth(publishers, auth);
  if (!publisherEntry) return false;
  const [publisherKey, publisher] = publisherEntry;
  return article.publisherId === publisherKey || normalizeIdentity(article.author) === normalizeIdentity(publisher.name);
}

const SURFAI_LEGACY_ID = "surfai-daily";
const SURFAI_AUTHOR = "DaveyNFTs";
const SURFAI_PAYEE = "0x1746978f956142e0482f0aff320d917ace450bcf";

function getDefaultSurfAIArticle() {
  return {
    id: SURFAI_LEGACY_ID,
    title: "SurfAI Daily Intelligence Dispatch",
    author: SURFAI_AUTHOR,
    snippet: "An autonomous intelligence report on capital flows, resource allocation, and micro-tariffs.",
    content: process.env.SURFAI_ARTICLE_CONTENT || [
      "## SurfAI Daily Intelligence Dispatch",
      "",
      "This report was compiled by the SurfAI autonomous agent network.",
      "",
      "- **Asset inspected:** USDC / ARC",
      "- **Network:** Arc Testnet",
      "- **Settlement:** 0.15 USDC",
      "",
      "The optional signed PDF is available below when a protected report URL is configured.",
    ].join("\n"),
    pdfUrl: process.env.SURFAI_PDF_URL || "",
    videoUrl: process.env.SURFAI_VIDEO_URL || "",
    price: "0.15",
    payee: SURFAI_PAYEE,
    listed: true,
    kind: "surfai",
  };
}

function normalizeSurfAIReport(report, id) {
  return {
    ...getDefaultSurfAIArticle(),
    ...report,
    id,
    author: SURFAI_AUTHOR,
    payee: SURFAI_PAYEE,
    kind: "surfai",
    listed: report?.listed !== false,
  };
}

function getSurfAIReportsFromSettings(settings) {
  if (settings.surfaiReports && Object.keys(settings.surfaiReports).length) {
    return Object.entries(settings.surfaiReports).map(([id, report]) => normalizeSurfAIReport(report, id));
  }
  return [normalizeSurfAIReport(settings.surfai || {}, SURFAI_LEGACY_ID)];
}

function sortSurfAIReports(reports) {
  return [...reports].sort((left, right) =>
    Number(right.createdAt || right.updatedAt || 0) - Number(left.createdAt || left.updatedAt || 0)
  );
}

function materializeSurfAIReports(settings) {
  if (!settings.surfaiReports || !Object.keys(settings.surfaiReports).length) {
    const legacy = normalizeSurfAIReport(settings.surfai || {}, SURFAI_LEGACY_ID);
    settings.surfaiReports = {
      [SURFAI_LEGACY_ID]: {
        title: legacy.title,
        snippet: legacy.snippet,
        content: legacy.content,
        price: legacy.price,
        pdfUrl: legacy.pdfUrl,
        videoUrl: legacy.videoUrl,
        listed: legacy.listed,
        createdAt: legacy.createdAt || legacy.updatedAt || Date.now(),
        updatedAt: legacy.updatedAt || Date.now(),
        updatedBy: legacy.updatedBy || "legacy-migration",
      },
    };
    settings.featuredSurfAIReportId ||= SURFAI_LEGACY_ID;
  }
  return settings.surfaiReports;
}

async function getSurfAIReports() {
  const settings = await store.read("settings");
  return sortSurfAIReports(getSurfAIReportsFromSettings(settings));
}

async function getSurfAIArticle(articleId) {
  const settings = await store.read("settings");
  const reports = getSurfAIReportsFromSettings(settings);
  if (articleId) return reports.find((report) => report.id === articleId) || null;
  const listed = reports.filter((report) => report.listed);
  if (!listed.length) return null;
  return listed.find((report) => report.id === settings.featuredSurfAIReportId) || sortSurfAIReports(listed)[0];
}

async function getArticle(articleId) {
  const articles = await store.read("articles");
  const storedArticle = articles.find((item) => item.id === articleId);
  if (storedArticle) return storedArticle;
  return String(articleId).startsWith("surfai-") ? getSurfAIArticle(articleId) : null;
}

async function getUserRecord(auth) {
  const users = await store.read("users");
  return users[auth.accountKey] || null;
}

async function initializeUserWallet(auth) {
  let wallet;
  if (isMockMode) {
    wallet = { id: crypto.randomUUID(), address: `0x${crypto.randomBytes(20).toString("hex")}` };
  } else if (isLiveMode) {
    wallet = await createCircleWallet(stableIdempotencyKey(auth.userId));
  } else {
    const error = new Error("Payments are disabled");
    error.statusCode = 503;
    throw error;
  }

  let result;
  await store.update("users", (users) => {
    if (!users[auth.accountKey]) {
      users[auth.accountKey] = {
        privyUserId: auth.userId,
        email: auth.email || null,
        walletId: wallet.id,
        address: wallet.address,
        balance: "0.00",
        unlockedArticles: {},
        processedOperations: {},
      };
    }
    result = users[auth.accountKey];
  });
  return result;
}

async function getOrCreateUserWallet(auth) {
  let result = (await store.read("users"))[auth.accountKey];
  if (!result) {
    let initialization = walletInitializationPromises.get(auth.accountKey);
    if (!initialization) {
      // Circle wallet creation stays outside the shared data lock, while the
      // per-account promise prevents concurrent requests from repeating the
      // same database write in one server instance.
      initialization = initializeUserWallet(auth);
      walletInitializationPromises.set(auth.accountKey, initialization);
    }
    try {
      result = await initialization;
    } finally {
      if (walletInitializationPromises.get(auth.accountKey) === initialization) {
        walletInitializationPromises.delete(auth.accountKey);
      }
    }
  }

  let walletStatus = "READY";
  let walletWarning = null;
  if (isLiveMode) {
    try {
      const balance = await getWalletUsdcBalance(result.walletId);
      await store.update("users", (users) => {
        users[auth.accountKey].balance = balance;
        users[auth.accountKey].balanceSyncedAt = Date.now();
        result = users[auth.accountKey];
      });
    } catch (error) {
      // A transient Circle balance outage must not hide an already-created
      // wallet or its entitlements from the reader. Return the cached balance
      // and expose a degraded state so the client can retry explicitly.
      walletStatus = "DEGRADED";
      walletWarning = "Wallet loaded, but the live balance could not be refreshed.";
      console.error(`[PaperCut API] Balance refresh failed for ${auth.accountKey}:`, error.message);
    }
  }
  const reconciled = await reconcileStoredPaymentOperations(auth, result);
  return { ...reconciled, walletStatus, walletWarning };
}

async function createOperation(operation) {
  await store.update("transactions", (transactions) => {
    transactions[operation.id] = operation;
  });
}

async function updateOperation(operationId, updater) {
  let result;
  await store.update("transactions", (transactions) => {
    const operation = transactions[operationId];
    if (!operation) throw new Error("Payment operation not found");
    updater(operation);
    operation.updatedAt = Date.now();
    result = operation;
  });
  return result;
}

async function clearReservation(operation) {
  if (["faucet", "unlock", "withdraw"].includes(operation.type)) {
    await store.update("users", (users) => {
      const user = users[operation.accountKey];
      if (!user) return;
      const matchesReservation = (value) => value === operation.id || value === "reserved";
      if (operation.type === "faucet" && matchesReservation(user.pendingFaucet)) delete user.pendingFaucet;
      if (operation.type === "withdraw" && matchesReservation(user.pendingWithdrawal)) delete user.pendingWithdrawal;
      if (operation.type === "unlock" && matchesReservation(user.pendingUnlocks?.[operation.articleId])) {
        delete user.pendingUnlocks[operation.articleId];
      }
    });
  }
  if (operation.type === "claim") {
    await store.update("publishers", (publishers) => {
      const publisher = publishers[operation.publisherKey];
      if (publisher && (publisher.pendingClaim === operation.id || publisher.pendingClaim === "reserved")) {
        delete publisher.pendingClaim;
      }
    });
  }
}

async function finalizeOperation(operationId, circleResult) {
  let operation = (await store.read("transactions"))[operationId];
  if (!operation) throw new Error("Payment operation not found");
  if (operation.status === "COMPLETE" || operation.status === "FAILED") return operation;

  if (CIRCLE_TERMINAL_FAILURES.has(circleResult.state)) {
    await clearReservation(operation);
    return updateOperation(operationId, (item) => {
      item.status = "FAILED";
      item.circleState = circleResult.state;
      item.error = `Circle transaction ended in ${circleResult.state}`;
    });
  }
  if (circleResult.state !== "COMPLETE") {
    return updateOperation(operationId, (item) => {
      item.status = "PENDING";
      item.circleState = circleResult.state;
    });
  }

  const liveBalance = isLiveMode && operation.userWalletId
    ? await getWalletUsdcBalance(operation.userWalletId)
    : null;
  const txHash = circleResult.txHash || operation.txHash || operation.id;

  if (["faucet", "unlock", "withdraw"].includes(operation.type)) {
    await store.update("users", (users) => {
      const user = users[operation.accountKey];
      if (!user) throw new Error("User wallet disappeared while finalizing payment");
      user.processedOperations ||= {};
      if (!user.processedOperations[operation.id]) {
        const current = parseUsdc(user.balance || "0", { allowZero: true, max: null });
        const amount = parseUsdc(operation.amount, { max: null });
        if (operation.type === "faucet") {
          user.balance = liveBalance || formatUsdc(current + amount);
          user.lastFaucetTime = operation.createdAt;
          delete user.pendingFaucet;
        } else if (operation.type === "unlock") {
          if (!liveBalance && current < amount) throw new Error("Insufficient mock balance during finalization");
          user.balance = liveBalance || formatUsdc(current - amount);
          user.unlockedArticles ||= {};
          user.unlockedArticles[operation.articleId] = { txHash, confirmedAt: Date.now(), amount: operation.amount };
          if (user.pendingUnlocks) delete user.pendingUnlocks[operation.articleId];
        } else {
          if (!liveBalance && current < amount) throw new Error("Insufficient mock balance during finalization");
          user.balance = liveBalance || formatUsdc(current - amount);
          user.withdrawalHistory ||= [];
          user.withdrawalHistory.unshift({ amount: operation.amount, destinationAddress: operation.destinationAddress, txHash, timestamp: Date.now() });
          delete user.pendingWithdrawal;
        }
        user.processedOperations[operation.id] = Date.now();
      }
    });
  }

  if (operation.type === "unlock" || operation.type === "claim") {
    await store.update("publishers", (publishers) => {
      const publisher = publishers[operation.publisherKey];
      if (!publisher) throw new Error("Publisher disappeared while finalizing payment");
      publisher.processedOperations ||= {};
      if (!publisher.processedOperations[operation.id]) {
        const amount = parseUsdc(operation.amount, { max: null });
        if (operation.type === "unlock") {
          const earned = parseUsdc(publisher.totalEarned || "0", { allowZero: true, max: null });
          publisher.totalEarned = formatUsdc(earned + amount);
        } else {
          const claimed = parseUsdc(publisher.totalClaimed || "0", { allowZero: true, max: null });
          publisher.totalClaimed = formatUsdc(claimed + amount);
          publisher.claimHistory ||= [];
          publisher.claimHistory.unshift({ amount: operation.amount, txHash, timestamp: Date.now() });
          delete publisher.pendingClaim;
        }
        publisher.processedOperations[operation.id] = Date.now();
      }
    });
  }

  operation = await updateOperation(operationId, (item) => {
    item.status = "COMPLETE";
    item.circleState = "COMPLETE";
    item.txHash = txHash;
    item.completedAt = Date.now();
  });
  return operation;
}

async function reconcileStoredPaymentOperations(auth, user) {
  if (!auth || !user) return user;
  const transactions = await store.read("transactions");
  const userOperations = Object.values(transactions).filter((operation) =>
    operationBelongsToUser(operation, auth, user)
  );

  // A browser may close before polling a pending payment. Re-check a bounded
  // number on every wallet load so a completed Circle transfer cannot remain
  // permanently detached from its entitlement.
  const pending = userOperations.filter((operation) =>
    ["INITIATED", "PENDING"].includes(operation.status) && operation.circleTransactionId
  ).slice(0, 10);
  for (const operation of pending) {
    try {
      await finalizeOperation(operation.id, await getCircleTransaction(operation.circleTransactionId));
    } catch (error) {
      console.error(`[PaperCut API] Could not reconcile payment ${operation.id}:`, error.message);
    }
  }

  const refreshedTransactions = pending.length ? await store.read("transactions") : transactions;
  const completedUnlocks = Object.values(refreshedTransactions).filter((operation) =>
    operation.type === "unlock" &&
    operation.status === "COMPLETE" &&
    operation.articleId &&
    operationBelongsToUser(operation, auth, user)
  );

  if (completedUnlocks.length) {
    await store.update("users", (users) => {
      const record = users[auth.accountKey];
      if (!record) return;
      record.unlockedArticles ||= {};
      record.processedOperations ||= {};
      for (const operation of completedUnlocks) {
        if (!record.unlockedArticles[operation.articleId]) {
          record.unlockedArticles[operation.articleId] = {
            txHash: operation.txHash || operation.circleTransactionId || operation.id,
            confirmedAt: operation.completedAt || operation.updatedAt || operation.createdAt || Date.now(),
            amount: operation.amount,
            recovered: true,
          };
        }
        record.processedOperations[operation.id] ||= operation.completedAt || Date.now();
      }
    });
  }

  return (await store.read("users"))[auth.accountKey] || user;
}

async function saveLegacyReceiptCheck(auth, txHash, check) {
  await store.update("users", (users) => {
    const record = users[auth.accountKey];
    if (!record) return;
    record.legacyReceiptChecks ||= {};
    if (Object.keys(record.legacyReceiptChecks).length < 100 || record.legacyReceiptChecks[txHash]) {
      record.legacyReceiptChecks[txHash] = check;
    }
  });
}

async function reconcileLegacyReceipt(auth, receipt) {
  const txHash = normalizeTxHash(receipt.txHash);
  const users = await store.read("users");
  const user = users[auth.accountKey];
  if (!user) return { articleId: receipt.articleId, status: "rejected", reason: "Wallet is not initialized" };
  if (user.unlockedArticles?.[receipt.articleId]) {
    return { articleId: receipt.articleId, status: "already-unlocked" };
  }

  const priorCheck = user.legacyReceiptChecks?.[txHash];
  if (priorCheck) {
    if (priorCheck.articleId !== receipt.articleId) {
      return { articleId: receipt.articleId, status: "rejected", reason: "Receipt was already assigned to another article" };
    }
    return { articleId: receipt.articleId, status: priorCheck.status, reason: priorCheck.reason };
  }

  const existingEntitlement = findEntitlementByTxHash(users, txHash);
  if (existingEntitlement) {
    const sameEntitlement = existingEntitlement.accountKey === auth.accountKey &&
      existingEntitlement.articleId === receipt.articleId;
    return {
      articleId: receipt.articleId,
      status: sameEntitlement ? "already-unlocked" : "rejected",
      ...(sameEntitlement ? {} : { reason: "Receipt was already used for another entitlement" }),
    };
  }

  const article = await getArticle(receipt.articleId);
  if (!article) {
    await saveLegacyReceiptCheck(auth, txHash, {
      articleId: receipt.articleId,
      status: "rejected",
      reason: "Article no longer exists",
      checkedAt: Date.now(),
    });
    return { articleId: receipt.articleId, status: "rejected", reason: "Article no longer exists" };
  }

  const transaction = await getCircleTransactionByHash(txHash);
  const verification = verifyLegacyCircleTransaction({
    transaction,
    txHash,
    user,
    article,
    publisherWalletAddress,
  });
  if (!verification.ok) {
    await saveLegacyReceiptCheck(auth, txHash, {
      articleId: receipt.articleId,
      status: "rejected",
      reason: verification.reason,
      checkedAt: Date.now(),
    });
    return { articleId: receipt.articleId, status: "rejected", reason: verification.reason };
  }

  let granted = false;
  await store.update("users", (currentUsers) => {
    const record = currentUsers[auth.accountKey];
    if (!record) return;
    const claimed = findEntitlementByTxHash(currentUsers, txHash);
    if (claimed && (claimed.accountKey !== auth.accountKey || claimed.articleId !== receipt.articleId)) return;

    record.unlockedArticles ||= {};
    record.legacyReceiptChecks ||= {};
    record.unlockedArticles[receipt.articleId] ||= {
      txHash,
      confirmedAt: Date.parse(transaction.updateDate || transaction.createDate || "") || Date.now(),
      amount: article.price,
      recovered: true,
    };
    record.legacyReceiptChecks[txHash] = {
      articleId: receipt.articleId,
      status: "verified",
      checkedAt: Date.now(),
    };
    granted = true;
  });

  return granted
    ? { articleId: receipt.articleId, status: "verified" }
    : { articleId: receipt.articleId, status: "rejected", reason: "Receipt was claimed concurrently" };
}

async function startTransfer({ operationId, type, auth, sourceWalletId, destinationAddress, amount, details = {} }) {
  if (PAYMENT_MODE === "disabled") {
    const error = new Error("Payments are currently disabled");
    error.statusCode = 503;
    throw error;
  }
  const id = operationId || crypto.randomUUID();
  const operation = {
    id,
    type,
    accountKey: auth?.accountKey || null,
    userId: auth?.userId || null,
    userWalletId: details.userWalletId || null,
    destinationAddress,
    amount,
    status: "INITIATED",
    createdAt: Date.now(),
    ...details,
  };
  await createOperation(operation);

  if (isMockMode) {
    return finalizeOperation(id, { state: "COMPLETE", txHash: `0x${crypto.randomBytes(32).toString("hex")}` });
  }

  let circleTransactionId = null;
  try {
    circleTransactionId = await createCircleTransfer({ operationId: id, sourceWalletId, destinationAddress, amount });
  } catch (error) {
    await clearReservation(operation);
    await updateOperation(id, (item) => {
      item.status = "FAILED";
      item.error = error.message;
    });
    throw error;
  }

  // Persist the Circle ID before any status polling. If storage is
  // temporarily unavailable after Circle accepted the transfer, leave the
  // reservation in place rather than allowing a second charge.
  await updateOperation(id, (item) => {
    item.circleTransactionId = circleTransactionId;
    item.status = "PENDING";
  });

  try {
    return await finalizeOperation(id, await pollCircleTransaction(circleTransactionId));
  } catch (error) {
    // Circle has already accepted this transfer. A timeout while reading its
    // status is not a failed payment and must not permit a duplicate charge.
    console.error(`[PaperCut API] Transaction ${id} remains pending after status check:`, error.message);
    return (await store.read("transactions"))[id];
  }
}

function operationResponse(operation) {
  return {
    success: operation.status === "COMPLETE",
    pending: operation.status === "PENDING" || operation.status === "INITIATED",
    status: operation.status,
    transactionId: operation.id,
    txHash: operation.txHash || operation.circleTransactionId || null,
    amount: operation.amount,
    type: operation.type,
    articleId: operation.articleId || null,
    circleState: operation.circleState || null,
    createdAt: operation.createdAt || null,
    updatedAt: operation.updatedAt || null,
    completedAt: operation.completedAt || null,
    error: operation.status === "FAILED" ? operation.error || "Payment operation failed" : null,
    isMock: isMockMode,
  };
}

async function listUserOperations(auth, user) {
  const transactions = await store.read("transactions");
  return Object.values(transactions)
    .filter((operation) => operationBelongsToUser(operation, auth, user))
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
}

async function buildUserLibrary(auth, user) {
  const [storedArticles, operations, surfAIReports] = await Promise.all([
    store.read("articles"),
    listUserOperations(auth, user),
    getSurfAIReports(),
  ]);
  const findLibraryArticle = (articleId) => storedArticles.find((entry) => entry.id === articleId) ||
    surfAIReports.find((report) => report.id === articleId) || null;
  const completedByArticle = new Map(
    operations
      .filter((operation) => operation.type === "unlock" && operation.status === "COMPLETE" && operation.articleId)
      .map((operation) => [operation.articleId, operation])
  );

  let totalSpent = 0n;
  const items = Object.entries(user.unlockedArticles || {}).map(([articleId, entitlement]) => {
    const article = findLibraryArticle(articleId);
    const operation = completedByArticle.get(articleId);
    const amount = typeof entitlement === "object" && entitlement?.amount
      ? entitlement.amount
      : operation?.amount || article?.price || "0";
    try {
      totalSpent += parseUsdc(amount, { allowZero: true, max: null });
    } catch (_error) {
      // Preserve the entitlement even if an imported legacy amount is malformed.
    }
    return {
      articleId,
      title: article?.title || "Archived dispatch",
      author: article?.author || "PaperCut Archive",
      snippet: article?.snippet || "This purchased dispatch is no longer listed on the front page.",
      price: article?.price || amount,
      amount,
      purchasedAt: typeof entitlement === "object"
        ? entitlement.confirmedAt || operation?.completedAt || operation?.createdAt || null
        : operation?.completedAt || operation?.createdAt || null,
      txHash: entitlementTxHash(entitlement) || normalizeTxHash(operation?.txHash) || null,
      transactionId: operation?.id || null,
      recovered: Boolean(typeof entitlement === "object" && entitlement?.recovered),
      status: "UNLOCKED",
    };
  }).sort((left, right) => Number(right.purchasedAt || 0) - Number(left.purchasedAt || 0));

  const pending = operations
    .filter((operation) => operation.type === "unlock" && ["INITIATED", "PENDING"].includes(operation.status))
    .map((operation) => {
      const article = findLibraryArticle(operation.articleId);
      return {
        ...operationResponse(operation),
        title: article?.title || "Dispatch payment",
        author: article?.author || "PaperCut",
      };
    });

  return {
    items,
    pending,
    summary: {
      totalItems: items.length,
      totalSpent: formatUsdc(totalSpent),
      currency: "USDC",
    },
  };
}

function ensureOperationAccepted(operation) {
  if (operation.status !== "FAILED") return;
  const error = new Error(operation.error || "Payment operation failed");
  error.statusCode = 502;
  throw error;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, paymentMode: PAYMENT_MODE, database: redisClient ? "redis" : "file" });
});

app.get("/api/surfai", async (_req, res, next) => {
  try {
    const article = await getSurfAIArticle();
    if (!article) return res.status(404).json({ error: "No SurfAI report is currently listed" });
    res.json({
      id: article.id,
      title: article.title,
      author: article.author,
      snippet: article.snippet,
      price: article.price,
      payee: article.payee,
      verified: true,
      category: "AI-Agent Autonomous Economics",
    });
  } catch (error) { next(error); }
});

app.get("/api/surfai/reports", async (_req, res, next) => {
  try {
    const reports = (await getSurfAIReports())
      .filter((article) => article.listed)
      .map(({ id, title, author, snippet, price, payee, createdAt, updatedAt }) => ({
        id, title, author, snippet, price, payee, createdAt, updatedAt,
        verified: true,
        category: "AI-Agent Autonomous Economics",
      }));
    res.json({ success: true, reports });
  } catch (error) { next(error); }
});

app.get("/api/articles", async (_req, res, next) => {
  try {
    const [articles, publishers] = await Promise.all([store.read("articles"), store.read("publishers")]);
    res.json(articles.map(({ id, title, author, snippet, price, payee }) => {
      const publisherEntry = Object.values(publishers).find((publisher) => normalizeIdentity(publisher.name) === normalizeIdentity(author));
      return { id, title, author, snippet, price, payee, verified: Boolean(publisherEntry?.verified) };
    }));
  } catch (error) { next(error); }
});

app.get("/api/articles/:id", optionalAuth, async (req, res, next) => {
  try {
    if (String(req.headers.authorization || "").startsWith("x402 ")) {
      return res.status(410).json({ error: "Legacy unsigned x402 access is disabled; use the authenticated unlock endpoint" });
    }
    const article = await getArticle(req.params.id);
    if (!article) return res.status(404).json({ error: "Article not found" });

    const publishers = await store.read("publishers");
    const ownsArticle = isArticleOwner(article, publishers, req.auth);
    let user = req.auth ? await getUserRecord(req.auth) : null;
    if (user) user = await reconcileStoredPaymentOperations(req.auth, user);
    const unlocked = Boolean(user?.unlockedArticles?.[article.id]);
    if (!ownsArticle && !unlocked) {
      return res.status(402).json({
        error: "Payment Required",
        price: article.price,
        currency: "USDC",
        articleId: article.id,
      });
    }
    const [pdfUrl, videoUrl] = await Promise.all([
      resolveProtectedAssetUrl(article.pdfUrl),
      resolveProtectedAssetUrl(article.videoUrl),
    ]);
    res.json({
      success: true,
      articleId: article.id,
      title: article.title,
      author: article.author,
      content: article.content,
      ...(pdfUrl ? { pdfUrl } : {}),
      ...(videoUrl ? { videoUrl } : {}),
    });
  } catch (error) { next(error); }
});

app.post("/api/articles", requireAuth, validate(schemas.articleCreate), async (req, res, next) => {
  try {
    const publishers = await store.read("publishers");
    const publisherEntry = getPublisherEntryForAuth(publishers, req.auth);
    if (!publisherEntry?.[1]?.verified) return res.status(403).json({ error: "A verified publisher account is required" });
    const [publisherKey, publisher] = publisherEntry;
    let article;
    await store.update("articles", (articles) => {
      article = {
        id: crypto.randomUUID(),
        title: req.validatedBody.title,
        author: publisher.name,
        publisherId: publisherKey,
        snippet: generateSnippet(req.validatedBody.content),
        content: req.validatedBody.content,
        price: req.validatedBody.price,
        payee: publisher.walletAddress,
      };
      articles.push(article);
    });
    res.status(201).json({ success: true, article });
  } catch (error) { next(error); }
});

app.put("/api/articles/:id", requireAuth, validate(schemas.articleUpdate), async (req, res, next) => {
  try {
    const publishers = await store.read("publishers");
    let updated;
    await store.update("articles", (articles) => {
      const index = articles.findIndex((article) => article.id === req.params.id);
      if (index < 0) { const error = new Error("Article not found"); error.statusCode = 404; throw error; }
      if (!isArticleOwner(articles[index], publishers, req.auth)) { const error = new Error("You do not own this article"); error.statusCode = 403; throw error; }
      articles[index] = {
        ...articles[index],
        title: req.validatedBody.title,
        content: req.validatedBody.content,
        price: req.validatedBody.price,
        snippet: generateSnippet(req.validatedBody.content),
      };
      updated = articles[index];
    });
    res.json({ success: true, article: updated });
  } catch (error) { next(error); }
});

app.delete("/api/articles/:id", requireAuth, async (req, res, next) => {
  try {
    const publishers = await store.read("publishers");
    await store.update("articles", (articles) => {
      const index = articles.findIndex((article) => article.id === req.params.id);
      if (index < 0) { const error = new Error("Article not found"); error.statusCode = 404; throw error; }
      if (!isArticleOwner(articles[index], publishers, req.auth)) { const error = new Error("You do not own this article"); error.statusCode = 403; throw error; }
      articles.splice(index, 1);
    });
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.get("/api/publishers", optionalAuth, async (req, res, next) => {
  try {
    const publishers = await store.read("publishers");
    if (isAdminIdentity(req.auth)) return res.json(publishers);

    const response = {};
    for (const [key, publisher] of Object.entries(publishers)) {
      const ownRecord = req.auth && (key === req.auth.accountKey || publisher.privyUserId === req.auth.userId);
      const responseKey = ownRecord ? req.auth.accountKey : publicPublisherId(key);
      response[responseKey] = {
        name: publisher.name,
        domain: publisher.domain,
        walletAddress: publisher.walletAddress,
        verified: Boolean(publisher.verified),
        category: publisher.category || "General",
        ...(ownRecord ? {
          totalEarned: publisher.totalEarned || "0.00",
          totalClaimed: publisher.totalClaimed || "0.00",
          claimHistory: publisher.claimHistory || [],
        } : {}),
      };
    }
    res.json(response);
  } catch (error) { next(error); }
});

app.post("/api/publishers", requireAuth, async (req, res, next) => {
  try {
    const admin = isAdminIdentity(req.auth);
    const parsed = (admin && req.body.email ? schemas.adminPublisherCreate : schemas.publisherApplication).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid publisher application", details: parsed.error.issues });
    const key = admin && parsed.data.email ? parsed.data.email : req.auth.accountKey;
    let publisher;
    await store.update("publishers", (publishers) => {
      if (publishers[key] && !admin) { const error = new Error("A publisher application already exists"); error.statusCode = 409; throw error; }
      publisher = {
        ...publishers[key],
        name: parsed.data.name,
        domain: parsed.data.domain,
        walletAddress: parsed.data.walletAddress,
        category: parsed.data.category || "General",
        verified: admin ? Boolean(publishers[key]?.verified) : false,
        privyUserId: admin ? publishers[key]?.privyUserId || null : req.auth.userId,
        totalEarned: publishers[key]?.totalEarned || "0.00",
        totalClaimed: publishers[key]?.totalClaimed || "0.00",
      };
      publishers[key] = publisher;
    });
    res.status(201).json({ success: true, publisher });
  } catch (error) { next(error); }
});

app.put("/api/publishers/verify", requireAuth, requireAdmin, validate(schemas.publisherVerify), async (req, res, next) => {
  try {
    let publisher;
    await store.update("publishers", (publishers) => {
      publisher = publishers[req.validatedBody.email];
      if (!publisher) { const error = new Error("Publisher not found"); error.statusCode = 404; throw error; }
      publisher.verified = req.validatedBody.verified;
    });
    res.json({ success: true, publisher });
  } catch (error) { next(error); }
});

app.put("/api/publishers/:email/verify", requireAuth, requireAdmin, async (req, res, next) => {
  req.body = { ...req.body, email: req.params.email };
  validate(schemas.publisherVerify)(req, res, async () => {
    try {
      await store.update("publishers", (publishers) => {
        if (!publishers[req.validatedBody.email]) { const error = new Error("Publisher not found"); error.statusCode = 404; throw error; }
        publishers[req.validatedBody.email].verified = req.validatedBody.verified;
      });
      res.json({ success: true });
    } catch (error) { next(error); }
  });
});

async function deletePublisher(req, res, next) {
  try {
    const email = normalizeIdentity(req.query.email || req.params.email || req.body.email);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "A valid publisher email is required" });
    await store.update("publishers", (publishers) => {
      if (!publishers[email]) { const error = new Error("Publisher not found"); error.statusCode = 404; throw error; }
      delete publishers[email];
    });
    res.json({ success: true });
  } catch (error) { next(error); }
}
app.delete("/api/publishers", requireAuth, requireAdmin, deletePublisher);
app.delete("/api/publishers/:email", requireAuth, requireAdmin, deletePublisher);

app.get("/api/admin/session", requireAuth, (req, res) => {
  res.json({ authenticated: isAdminIdentity(req.auth), email: req.auth.email || null });
});
app.post("/api/admin/session", requireAuth, (req, res) => {
  const authenticated = isAdminIdentity(req.auth);
  res.status(authenticated ? 200 : 403).json({ authenticated, success: authenticated, email: req.auth.email || null });
});

app.get("/api/admin/surfai", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const surfai = await getSurfAIArticle();
    res.json({ success: true, surfai });
  } catch (error) { next(error); }
});

app.put("/api/admin/surfai", requireAuth, requireAdmin, validate(schemas.surfaiUpdate), async (req, res, next) => {
  try {
    const updatedAt = Date.now();
    await store.update("settings", (settings) => {
      const reports = materializeSurfAIReports(settings);
      const reportId = settings.featuredSurfAIReportId || SURFAI_LEGACY_ID;
      reports[reportId] = {
        ...reports[reportId],
        ...req.validatedBody,
        listed: true,
        createdAt: reports[reportId]?.createdAt || updatedAt,
        updatedAt,
        updatedBy: req.auth.email || req.auth.userId,
      };
      settings.featuredSurfAIReportId = reportId;
    });
    res.json({ success: true, surfai: await getSurfAIArticle() });
  } catch (error) { next(error); }
});

app.get("/api/admin/uploads/config", requireAuth, requireAdmin, (_req, res) => {
  res.json({ success: true, r2: r2StorageStatus() });
});

app.post("/api/admin/uploads/presign", requireAuth, requireAdmin, validate(schemas.r2UploadRequest), async (req, res, next) => {
  try {
    const upload = await createR2Upload(req.validatedBody);
    res.json({
      success: true,
      ...upload,
      previewUrl: await resolveProtectedAssetUrl(upload.assetRef),
    });
  } catch (error) { next(error); }
});

app.get("/api/admin/surfai/reports", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const [reports, users, settings] = await Promise.all([
      getSurfAIReports(),
      store.read("users"),
      store.read("settings"),
    ]);
    const purchaseCounts = Object.values(users).reduce((counts, user) => {
      Object.keys(user.unlockedArticles || {}).forEach((articleId) => {
        counts[articleId] = (counts[articleId] || 0) + 1;
      });
      return counts;
    }, {});
    const reportsWithPreviews = await Promise.all(reports.map(async (report) => {
      let pdfPreviewUrl = "";
      let videoPreviewUrl = "";
      try {
        [pdfPreviewUrl, videoPreviewUrl] = await Promise.all([
          resolveProtectedAssetUrl(report.pdfUrl),
          resolveProtectedAssetUrl(report.videoUrl),
        ]);
      } catch (_error) {
        // Keep the editor available if R2 credentials are temporarily unavailable.
      }
      return {
        ...report,
        purchaseCount: purchaseCounts[report.id] || 0,
        pdfPreviewUrl,
        videoPreviewUrl,
      };
    }));
    res.json({
      success: true,
      featuredReportId: settings.featuredSurfAIReportId || reports.find((report) => report.listed)?.id || null,
      r2: r2StorageStatus(),
      reports: reportsWithPreviews,
    });
  } catch (error) { next(error); }
});

app.post("/api/admin/surfai/reports", requireAuth, requireAdmin, validate(schemas.surfaiReportCreate), async (req, res, next) => {
  try {
    const reportId = `surfai-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`;
    const now = Date.now();
    await store.update("settings", (settings) => {
      const reports = materializeSurfAIReports(settings);
      if (req.validatedBody.replaceCurrent) {
        Object.values(reports).forEach((report) => { report.listed = false; });
      }
      const { replaceCurrent: _replaceCurrent, ...fields } = req.validatedBody;
      reports[reportId] = {
        ...fields,
        listed: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: req.auth.email || req.auth.userId,
      };
      settings.featuredSurfAIReportId = reportId;
    });
    res.status(201).json({ success: true, surfai: await getSurfAIArticle(reportId) });
  } catch (error) { next(error); }
});

app.put("/api/admin/surfai/reports/:id", requireAuth, requireAdmin, validate(schemas.surfaiReportUpdate), async (req, res, next) => {
  try {
    const reportId = req.params.id;
    if (!/^surfai-[a-zA-Z0-9-]{1,120}$/.test(reportId)) return res.status(400).json({ error: "Invalid SurfAI report ID" });
    const now = Date.now();
    await store.update("settings", (settings) => {
      const reports = materializeSurfAIReports(settings);
      const current = reports[reportId];
      if (!current) { const error = new Error("SurfAI report not found"); error.statusCode = 404; throw error; }
      reports[reportId] = {
        ...current,
        ...req.validatedBody,
        createdAt: current.createdAt || now,
        updatedAt: now,
        updatedBy: req.auth.email || req.auth.userId,
      };
      if (req.validatedBody.listed) {
        settings.featuredSurfAIReportId = reportId;
      } else if (settings.featuredSurfAIReportId === reportId) {
        settings.featuredSurfAIReportId = Object.entries(reports).find(([id, report]) => id !== reportId && report.listed)?.[0] || null;
      }
    });
    res.json({ success: true, surfai: await getSurfAIArticle(reportId) });
  } catch (error) { next(error); }
});

app.post("/api/user/wallet", requireAuth, async (req, res, next) => {
  try {
    const user = await getOrCreateUserWallet(req.auth);
    const pendingOperations = (await listUserOperations(req.auth, user))
      .filter((operation) => ["INITIATED", "PENDING"].includes(operation.status))
      .map(operationResponse);
    res.json({
      walletId: user.walletId,
      address: user.address,
      balance: user.balance,
      balanceSyncedAt: user.balanceSyncedAt || null,
      walletStatus: user.walletStatus || "READY",
      walletWarning: user.walletWarning || null,
      pendingOperations,
      unlockedArticles: user.unlockedArticles || {},
      isMock: isMockMode,
    });
  } catch (error) { next(error); }
});

app.get("/api/user/library", requireAuth, async (req, res, next) => {
  try {
    const user = await getOrCreateUserWallet(req.auth);
    res.json({ success: true, ...(await buildUserLibrary(req.auth, user)) });
  } catch (error) { next(error); }
});

app.post("/api/user/entitlements/reconcile", requireAuth, validate(schemas.entitlementReconcile), async (req, res, next) => {
  try {
    let user = await getOrCreateUserWallet(req.auth);
    const results = [];
    for (const receipt of req.validatedBody.receipts) {
      try {
        results.push(await reconcileLegacyReceipt(req.auth, receipt));
      } catch (error) {
        console.error(`[PaperCut API] Legacy receipt reconciliation failed for article ${receipt.articleId}:`, error.message);
        results.push({ articleId: receipt.articleId, status: "retryable-error" });
      }
    }
    user = await reconcileStoredPaymentOperations(req.auth, user);
    res.json({ success: true, results, unlockedArticles: user.unlockedArticles || {} });
  } catch (error) { next(error); }
});

const faucetLimiter = rateLimit({ windowMs: 30 * 60 * 1000, limit: 3, standardHeaders: "draft-7", legacyHeaders: false });
app.post("/api/user/faucet", requireAuth, faucetLimiter, async (req, res, next) => {
  const amount = "1.00";
  const operationId = crypto.randomUUID();
  try {
    const user = await getOrCreateUserWallet(req.auth);
    const now = Date.now();
    await store.update("users", (users) => {
      const record = users[req.auth.accountKey];
      if (record.pendingFaucet) { const error = new Error("A faucet transfer is already pending"); error.statusCode = 409; throw error; }
      if (now - Number(record.lastFaucetTime || 0) < 30 * 60 * 1000) { const error = new Error("Faucet cooldown is active"); error.statusCode = 429; throw error; }
      record.pendingFaucet = operationId;
    });

    const operation = await startTransfer({
      operationId,
      type: "faucet",
      auth: req.auth,
      sourceWalletId: process.env.PUBLISHER_WALLET_ID,
      destinationAddress: user.address,
      amount,
      details: { userWalletId: user.walletId },
    });
    ensureOperationAccepted(operation);
    const refreshed = await getUserRecord(req.auth);
    res.status(operation.status === "COMPLETE" ? 200 : 202).json({ ...operationResponse(operation), balance: refreshed?.balance });
  } catch (error) {
    await store.update("users", (users) => {
      const record = users[req.auth.accountKey];
      if (record?.pendingFaucet === operationId || record?.pendingFaucet === "reserved") delete record.pendingFaucet;
    }).catch(() => undefined);
    next(error);
  }
});

app.post("/api/articles/unlock", requireAuth, validate(schemas.articleUnlock), async (req, res, next) => {
  const operationId = crypto.randomUUID();
  try {
    const article = await getArticle(req.validatedBody.articleId);
    if (!article) return res.status(404).json({ error: "Article not found" });
    const user = await getOrCreateUserWallet(req.auth);
    if (article.kind === "surfai" && !article.listed && !user.unlockedArticles?.[article.id]) {
      return res.status(409).json({ error: "This SurfAI report is archived and not currently available for purchase" });
    }
    const publishers = await store.read("publishers");
    const publisherEntry = findPublisherForArticle(publishers, article);
    if (!publisherEntry?.[1]?.verified) return res.status(409).json({ error: "Article publisher is not verified" });
    const [publisherKey] = publisherEntry;

    // getOrCreateUserWallet has just refreshed the live Circle balance.
    const liveBalance = user.balance;
    const cost = parseUsdc(article.price, { max: "1000" });
    if (parseUsdc(liveBalance, { allowZero: true, max: null }) < cost) {
      return res.status(402).json({ error: "Insufficient balance", balance: liveBalance });
    }

    await store.update("users", (users) => {
      const record = users[req.auth.accountKey];
      record.balance = liveBalance;
      if (record.unlockedArticles?.[article.id]) { const error = new Error("Article is already unlocked"); error.statusCode = 409; throw error; }
      record.pendingUnlocks ||= {};
      if (record.pendingUnlocks[article.id]) { const error = new Error("An unlock payment is already pending"); error.statusCode = 409; throw error; }
      record.pendingUnlocks[article.id] = operationId;
    });

    const operation = await startTransfer({
      operationId,
      type: "unlock",
      auth: req.auth,
      sourceWalletId: user.walletId,
      destinationAddress: publisherWalletAddress,
      amount: formatUsdc(cost),
      details: { userWalletId: user.walletId, articleId: article.id, publisherKey },
    });
    ensureOperationAccepted(operation);
    const refreshed = await getUserRecord(req.auth);
    res.status(operation.status === "COMPLETE" ? 200 : 202).json({ ...operationResponse(operation), balance: refreshed?.balance });
  } catch (error) {
    await store.update("users", (users) => {
      const pending = users[req.auth.accountKey]?.pendingUnlocks;
      if ([operationId, "reserved"].includes(pending?.[req.validatedBody?.articleId])) delete pending[req.validatedBody.articleId];
    }).catch(() => undefined);
    next(error);
  }
});

app.post("/api/user/withdraw", requireAuth, validate(schemas.withdraw), async (req, res, next) => {
  const operationId = crypto.randomUUID();
  try {
    const user = await getOrCreateUserWallet(req.auth);
    // getOrCreateUserWallet has just refreshed the live Circle balance.
    const liveBalance = user.balance;
    const amount = parseUsdc(req.validatedBody.amount, { max: null });
    if (parseUsdc(liveBalance, { allowZero: true, max: null }) < amount) {
      return res.status(400).json({ error: "Insufficient balance for withdrawal", balance: liveBalance });
    }
    await store.update("users", (users) => {
      const record = users[req.auth.accountKey];
      if (record.pendingWithdrawal) { const error = new Error("A withdrawal is already pending"); error.statusCode = 409; throw error; }
      record.balance = liveBalance;
      record.pendingWithdrawal = operationId;
    });
    const operation = await startTransfer({
      operationId,
      type: "withdraw",
      auth: req.auth,
      sourceWalletId: user.walletId,
      destinationAddress: req.validatedBody.destinationAddress,
      amount: formatUsdc(amount),
      details: { userWalletId: user.walletId },
    });
    ensureOperationAccepted(operation);
    const refreshed = await getUserRecord(req.auth);
    res.status(operation.status === "COMPLETE" ? 200 : 202).json({ ...operationResponse(operation), balance: refreshed?.balance });
  } catch (error) {
    await store.update("users", (users) => {
      const record = users[req.auth.accountKey];
      if ([operationId, "reserved"].includes(record?.pendingWithdrawal)) delete record.pendingWithdrawal;
    }).catch(() => undefined);
    next(error);
  }
});

app.post("/api/publishers/claim", requireAuth, async (req, res, next) => {
  const operationId = crypto.randomUUID();
  try {
    const publishers = await store.read("publishers");
    const publisherEntry = getPublisherEntryForAuth(publishers, req.auth);
    if (!publisherEntry?.[1]?.verified) return res.status(403).json({ error: "A verified publisher account is required" });
    const [publisherKey, publisher] = publisherEntry;
    if (publisher.pendingClaim) return res.status(409).json({ error: "A claim is already pending" });
    const earned = parseUsdc(publisher.totalEarned || "0", { allowZero: true, max: null });
    const claimed = parseUsdc(publisher.totalClaimed || "0", { allowZero: true, max: null });
    if (earned <= claimed) return res.status(400).json({ error: "No revenue available to claim" });
    const amount = formatUsdc(earned - claimed);
    await store.update("publishers", (items) => { items[publisherKey].pendingClaim = operationId; });
    const operation = await startTransfer({
      operationId,
      type: "claim",
      auth: req.auth,
      sourceWalletId: process.env.PUBLISHER_WALLET_ID,
      destinationAddress: publisher.walletAddress,
      amount,
      details: { publisherKey },
    });
    ensureOperationAccepted(operation);
    const refreshed = (await store.read("publishers"))[publisherKey];
    res.status(operation.status === "COMPLETE" ? 200 : 202).json({
      ...operationResponse(operation),
      totalClaimed: refreshed.totalClaimed,
      claimHistory: refreshed.claimHistory || [],
    });
  } catch (error) {
    const publishers = await store.read("publishers").catch(() => ({}));
    const publisherEntry = getPublisherEntryForAuth(publishers, req.auth);
    if (publisherEntry) {
      await store.update("publishers", (items) => {
        if ([operationId, "reserved"].includes(items[publisherEntry[0]]?.pendingClaim)) delete items[publisherEntry[0]].pendingClaim;
      }).catch(() => undefined);
    }
    next(error);
  }
});

app.get("/api/transactions/:id", requireAuth, async (req, res, next) => {
  try {
    let operation = (await store.read("transactions"))[req.params.id];
    if (!operation) return res.status(404).json({ error: "Payment operation not found" });
    const user = await getUserRecord(req.auth);
    if ((!user || !operationBelongsToUser(operation, req.auth, user)) && !isAdminIdentity(req.auth)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (isLiveMode && operation.status === "PENDING" && operation.circleTransactionId) {
      operation = await finalizeOperation(operation.id, await getCircleTransaction(operation.circleTransactionId));
    }
    res.status(operation.status === "PENDING" ? 202 : 200).json(operationResponse(operation));
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  const status = Number(error.statusCode || 500);
  if (status >= 500) console.error("[PaperCut API]", error.message);
  res.status(status).json({ error: status >= 500 && NODE_ENV === "production" ? "Internal server error" : error.message });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`[PaperCut API] Listening on http://localhost:${PORT} (${PAYMENT_MODE} payments)`));
}

module.exports = app;
