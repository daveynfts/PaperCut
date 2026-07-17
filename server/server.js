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
const { formatUsdc, parseUsdc } = require("./money");
const { PaperCutStore } = require("./store");
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

async function createCircleWallet() {
  const payload = await circleRequest("https://api.circle.com/v1/w3s/developer/wallets", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
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
  return formatUsdc(parseUsdc(usdc?.amount || "0", { allowZero: true, max: null }));
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

async function pollCircleTransaction(transactionId, attempts = 5) {
  let result = { state: "INITIATED", txHash: "" };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    result = await getCircleTransaction(transactionId);
    if (result.state === "COMPLETE" || CIRCLE_TERMINAL_FAILURES.has(result.state)) return result;
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return result;
}

const startup = (async () => {
  assertPaymentConfiguration();
  await Promise.all([store.init(), initializePublisherWallet()]);
})();

app.use("/api", async (_req, res, next) => {
  try {
    await startup;
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

function getSpecialArticle(articleId) {
  if (articleId !== "surfai-daily") return null;
  return {
    id: "surfai-daily",
    title: "SurfAI Daily Intelligence Dispatch",
    author: "DaveyNFTs",
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
    price: "0.15",
    payee: "0x1746978f956142e0482f0aff320d917ace450bcf",
  };
}

async function getArticle(articleId) {
  const articles = await store.read("articles");
  return articles.find((item) => item.id === articleId) || getSpecialArticle(articleId);
}

async function getUserRecord(auth) {
  const users = await store.read("users");
  return users[auth.accountKey] || null;
}

async function getOrCreateUserWallet(auth) {
  let result;
  await store.update("users", async (users) => {
    if (!users[auth.accountKey]) {
      let wallet;
      if (isMockMode) {
        wallet = { id: crypto.randomUUID(), address: `0x${crypto.randomBytes(20).toString("hex")}` };
      } else if (isLiveMode) {
        wallet = await createCircleWallet();
      } else {
        const error = new Error("Payments are disabled");
        error.statusCode = 503;
        throw error;
      }
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

  if (isLiveMode) {
    const balance = await getWalletUsdcBalance(result.walletId);
    await store.update("users", (users) => {
      users[auth.accountKey].balance = balance;
      result = users[auth.accountKey];
    });
  }
  return result;
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

  try {
    const circleTransactionId = await createCircleTransfer({ operationId: id, sourceWalletId, destinationAddress, amount });
    await updateOperation(id, (item) => {
      item.circleTransactionId = circleTransactionId;
      item.status = "PENDING";
    });
    return finalizeOperation(id, await pollCircleTransaction(circleTransactionId));
  } catch (error) {
    await clearReservation(operation);
    await updateOperation(id, (item) => {
      item.status = "FAILED";
      item.error = error.message;
    });
    throw error;
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
    isMock: isMockMode,
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
    const user = req.auth ? await getUserRecord(req.auth) : null;
    const unlocked = Boolean(user?.unlockedArticles?.[article.id]);
    if (!ownsArticle && !unlocked) {
      return res.status(402).json({
        error: "Payment Required",
        price: article.price,
        currency: "USDC",
        articleId: article.id,
      });
    }
    res.json({
      success: true,
      articleId: article.id,
      title: article.title,
      author: article.author,
      content: article.content,
      ...(article.pdfUrl ? { pdfUrl: article.pdfUrl } : {}),
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

app.post("/api/user/wallet", requireAuth, async (req, res, next) => {
  try {
    const user = await getOrCreateUserWallet(req.auth);
    res.json({
      walletId: user.walletId,
      address: user.address,
      balance: user.balance,
      unlockedArticles: user.unlockedArticles || {},
      isMock: isMockMode,
    });
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
    const publishers = await store.read("publishers");
    const publisherEntry = findPublisherForArticle(publishers, article);
    if (!publisherEntry?.[1]?.verified) return res.status(409).json({ error: "Article publisher is not verified" });
    const [publisherKey] = publisherEntry;

    const liveBalance = isLiveMode ? await getWalletUsdcBalance(user.walletId) : user.balance;
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
    const liveBalance = isLiveMode ? await getWalletUsdcBalance(user.walletId) : user.balance;
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
    if (operation.userId !== req.auth.userId && !isAdminIdentity(req.auth)) return res.status(403).json({ error: "Access denied" });
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
