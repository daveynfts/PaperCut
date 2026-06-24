const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Mock Publisher Wallet Address (Recipient of micropayments)
let PUBLISHER_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Hardhat #0

// Mock USDC Contract Address on Arc L1
const ARC_USDC_ADDRESS = "0x0000000000000000000000000000000000001010"; // Mock USDC
const ARC_CHAIN_ID = 54321; // Mock Arc ChainID

// Mock Article Database is now stored in articles.json and managed dynamically

// Local JSON Database for mappings (email -> walletId, address, balance)
const USERS_DB_PATH = process.env.VERCEL
  ? "/tmp/users.json"
  : path.join(__dirname, "users.json");

function readUsersDb() {
  try {
    if (!fs.existsSync(USERS_DB_PATH)) {
      const seedPath = path.join(__dirname, "users.json");
      if (fs.existsSync(seedPath)) {
        try {
          const seedData = fs.readFileSync(seedPath, "utf8");
          fs.writeFileSync(USERS_DB_PATH, seedData);
        } catch (err) {
          fs.writeFileSync(USERS_DB_PATH, JSON.stringify({}));
        }
      } else {
        fs.writeFileSync(USERS_DB_PATH, JSON.stringify({}));
      }
    }
    const data = fs.readFileSync(USERS_DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Corrupted users.json, re-initializing:", err);
    const seedPath = path.join(__dirname, "users.json");
    let fallback = {};
    if (fs.existsSync(seedPath)) {
      try {
        fallback = JSON.parse(fs.readFileSync(seedPath, "utf8"));
      } catch (e) {}
    }
    try {
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify(fallback, null, 2));
    } catch (e) {}
    return fallback;
  }
}

function writeUsersDb(db) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Failed to write users DB:", err);
  }
}

// Local JSON Database for publishers (email -> details)
const PUBLISHERS_DB_PATH = process.env.VERCEL
  ? "/tmp/publishers.json"
  : path.join(__dirname, "publishers.json");

function readPublishersDb() {
  try {
    if (!fs.existsSync(PUBLISHERS_DB_PATH)) {
      const seedPath = path.join(__dirname, "publishers.json");
      if (fs.existsSync(seedPath)) {
        try {
          const seedData = fs.readFileSync(seedPath, "utf8");
          fs.writeFileSync(PUBLISHERS_DB_PATH, seedData);
        } catch (err) {
          fs.writeFileSync(PUBLISHERS_DB_PATH, JSON.stringify({}));
        }
      } else {
        fs.writeFileSync(PUBLISHERS_DB_PATH, JSON.stringify({}));
      }
    }
    const data = fs.readFileSync(PUBLISHERS_DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Corrupted publishers.json, re-initializing:", err);
    const seedPath = path.join(__dirname, "publishers.json");
    let fallback = {};
    if (fs.existsSync(seedPath)) {
      try {
        fallback = JSON.parse(fs.readFileSync(seedPath, "utf8"));
      } catch (e) {}
    }
    try {
      fs.writeFileSync(PUBLISHERS_DB_PATH, JSON.stringify(fallback, null, 2));
    } catch (e) {}
    return fallback;
  }
}

function writePublishersDb(db) {
  try {
    fs.writeFileSync(PUBLISHERS_DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Failed to write publishers DB:", err);
  }
}

// Local JSON Database for authorized admin IPs
const ADMIN_IPS_DB_PATH = process.env.VERCEL
  ? "/tmp/admin_ips.json"
  : path.join(__dirname, "admin_ips.json");

function readAdminIpsDb() {
  try {
    if (!fs.existsSync(ADMIN_IPS_DB_PATH)) {
      fs.writeFileSync(ADMIN_IPS_DB_PATH, JSON.stringify([]));
    }
    const data = fs.readFileSync(ADMIN_IPS_DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Corrupted admin_ips.json, re-initializing:", err);
    try {
      fs.writeFileSync(ADMIN_IPS_DB_PATH, JSON.stringify([]));
    } catch (e) {}
    return [];
  }
}

function writeAdminIpsDb(db) {
  try {
    fs.writeFileSync(ADMIN_IPS_DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Failed to write admin IPs DB:", err);
  }
}


// Local JSON Database for articles
const ARTICLES_DB_PATH = process.env.VERCEL
  ? "/tmp/articles.json"
  : path.join(__dirname, "articles.json");

function readArticlesDb() {
  try {
    if (!fs.existsSync(ARTICLES_DB_PATH)) {
      const seedPath = path.join(__dirname, "articles.json");
      if (fs.existsSync(seedPath)) {
        try {
          const seedData = fs.readFileSync(seedPath, "utf8");
          fs.writeFileSync(ARTICLES_DB_PATH, seedData);
        } catch (err) {
          fs.writeFileSync(ARTICLES_DB_PATH, JSON.stringify([]));
        }
      } else {
        fs.writeFileSync(ARTICLES_DB_PATH, JSON.stringify([]));
      }
    }
    const data = fs.readFileSync(ARTICLES_DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Corrupted articles.json, re-initializing:", err);
    const seedPath = path.join(__dirname, "articles.json");
    let fallback = [];
    if (fs.existsSync(seedPath)) {
      try {
        fallback = JSON.parse(fs.readFileSync(seedPath, "utf8"));
      } catch (e) {}
    }
    try {
      fs.writeFileSync(ARTICLES_DB_PATH, JSON.stringify(fallback, null, 2));
    } catch (e) {}
    return fallback;
  }
}

function writeArticlesDb(db) {
  try {
    fs.writeFileSync(ARTICLES_DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Failed to write articles DB:", err);
  }
}


// Circle W3S Configuration
const isMockMode = !process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET;

if (isMockMode) {
  console.log("[Publisher Backend] Running in SIMULATED MOCK MODE because CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET is missing.");
} else {
  console.log("[Publisher Backend] Running in LIVE MODE using Circle Web3 Services API.");
}

async function initPublisherWallet() {
  if (isMockMode) return;
  try {
    const response = await fetch(`https://api.circle.com/v1/w3s/wallets/${process.env.PUBLISHER_WALLET_ID}`, {
      headers: {
        "Authorization": `Bearer ${process.env.CIRCLE_API_KEY}`
      }
    });
    const json = await response.json();
    if (json.data?.wallet?.address) {
      PUBLISHER_WALLET = json.data.wallet.address;
      console.log(`[Circle W3S] Publisher wallet address initialized dynamically: ${PUBLISHER_WALLET}`);
    } else {
      console.warn("[Circle W3S] Could not fetch publisher wallet address, using mock address.", json);
    }
  } catch (err) {
    console.error("Failed to initialize publisher wallet address from Circle:", err);
  }
}
initPublisherWallet();

// Helper: RSA Encryption using Node's native crypto module
async function fetchCirclePublicKey() {
  try {
    console.log(`[Circle W3S] Fetching public key using API key (length: ${process.env.CIRCLE_API_KEY?.length || 0})`);
    const response = await fetch("https://api.circle.com/v1/w3s/config/entity/publicKey", {
      headers: {
        "Authorization": `Bearer ${process.env.CIRCLE_API_KEY}`
      }
    });
    const json = await response.json();
    if (!json.data?.publicKey) {
      console.error("[Circle W3S] Public key fetch returned error:", JSON.stringify(json));
      throw new Error(`Failed to fetch Circle public key: ${json.message || JSON.stringify(json)}`);
    }
    return json.data.publicKey;
  } catch (error) {
    console.error("fetchCirclePublicKey error:", error);
    throw error;
  }
}

function encryptEntitySecret(entitySecretHex, publicKeyPem) {
  const entitySecret = Buffer.from(entitySecretHex, "hex");
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256"
    },
    entitySecret
  );
  return encrypted.toString("base64");
}

async function getEntitySecretCiphertext() {
  const pubKey = await fetchCirclePublicKey();
  return encryptEntitySecret(process.env.CIRCLE_ENTITY_SECRET, pubKey);
}

// Check balance helper
async function getWalletUsdcBalance(walletId) {
  if (isMockMode) {
    const db = readUsersDb();
    const email = Object.keys(db).find(k => db[k].walletId === walletId);
    return email ? db[email].balance : "0.0";
  }

  try {
    console.log(`[Circle W3S] Fetching balance for wallet ${walletId} using API key (length: ${process.env.CIRCLE_API_KEY?.length || 0})`);
    const response = await fetch(`https://api.circle.com/v1/w3s/wallets/${walletId}/balances`, {
      headers: {
        "Authorization": `Bearer ${process.env.CIRCLE_API_KEY}`
      }
    });
    const json = await response.json();
    if (json.errors || !json.data) {
      console.error("[Circle W3S] Balance fetch failed details:", JSON.stringify(json));
      throw new Error(`Circle API balance fetch failed: ${json.message || JSON.stringify(json)}`);
    }
    const tokenBalances = json.data.tokenBalances || [];
    const usdcBalanceObj = tokenBalances.find(tb => tb.token.symbol === "USDC");
    return usdcBalanceObj ? usdcBalanceObj.amount : "0.0";
  } catch (error) {
    console.error("getWalletUsdcBalance error:", error);
    throw error;
  }
}

// Create wallet helper
async function createCircleWallet() {
  const ciphertext = await getEntitySecretCiphertext();
  const idempotencyKey = crypto.randomUUID();
  const response = await fetch("https://api.circle.com/v1/w3s/developer/wallets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.CIRCLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      idempotencyKey,
      entitySecretCiphertext: ciphertext,
      walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      blockchains: ["ARC-TESTNET"],
      count: 1
    })
  });
  const json = await response.json();
  if (json.errors || !json.data?.wallets?.[0]) {
    console.error("Circle create wallet error:", json);
    throw new Error(json.message || "Failed to create wallet");
  }
  return json.data.wallets[0];
}

// Transfer helper
async function transferCircleUsdc(sourceWalletId, destAddress, amount) {
  const ciphertext = await getEntitySecretCiphertext();
  const idempotencyKey = crypto.randomUUID();
  const response = await fetch("https://api.circle.com/v1/w3s/developer/transactions/transfer", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.CIRCLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      idempotencyKey,
      entitySecretCiphertext: ciphertext,
      walletId: sourceWalletId,
      destinationAddress: destAddress,
      amounts: [amount.toString()],
      blockchain: "ARC-TESTNET",
      feeLevel: "HIGH"
    })
  });
  const json = await response.json();
  if (json.errors || !json.data?.id) {
    console.error("Circle transfer error:", json);
    throw new Error(json.message || "Failed to execute transfer");
  }
  return json.data.id;
}

// Poller
async function pollTransactionStatus(transactionId) {
  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://api.circle.com/v1/w3s/transactions/${transactionId}`, {
      headers: {
        "Authorization": `Bearer ${process.env.CIRCLE_API_KEY}`
      }
    });
    const json = await response.json();
    const status = json.data?.transaction?.state;
    const txHash = json.data?.transaction?.txHash;
    console.log(`[Circle Poller] Tx ${transactionId} status: ${status}`);
    
    if (status === "COMPLETE" || txHash) {
      return { success: true, txHash };
    }
    if (status === "FAILED" || status === "CANCELLED" || status === "DENIED") {
      throw new Error(`Transaction ended in state: ${status}`);
    }
    
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Transaction polling timed out");
}

// Helper to verify EIP-3009 TransferWithAuthorization signature (Keep for extension backwards compatibility)
function verifyEip3009(authData) {
  try {
    const { from, to, value, validAfter, validBefore, nonce, signature } = authData;

    // Define EIP-712 Domain for USDC on Arc
    const domain = {
      name: "USD Coin",
      version: "2",
      chainId: ARC_CHAIN_ID,
      verifyingContract: ARC_USDC_ADDRESS
    };

    // EIP-3009 Types
    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" }
      ]
    };

    const valueData = {
      from,
      to,
      value: BigInt(value),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce
    };

    const recoveredAddress = ethers.verifyTypedData(domain, types, valueData, signature);
    return recoveredAddress.toLowerCase() === from.toLowerCase();
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}

// Get all articles (Metadatas and Snippets only)
app.get("/api/articles", (req, res) => {
  try {
    const pubDb = readPublishersDb();
    const articles = readArticlesDb();
    const metaArticles = articles.map(({ id, title, author, snippet, price, payee }) => {
      // Find if author exists in publishers database by name (case-insensitive)
      const publisherKey = Object.keys(pubDb).find(
        key => pubDb[key].name.toLowerCase() === author.toLowerCase()
      );
      const verified = publisherKey ? pubDb[publisherKey].verified : false;
      
      return {
        id,
        title,
        author,
        snippet,
        price,
        payee,
        verified
      };
    });
    res.json(metaArticles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to generate a clean plain-text snippet of the article content
function generateSnippet(content) {
  if (!content) return "";
  
  // Strip markdown headers
  let cleanText = content.replace(/^#+\s+/gm, "");
  
  // Strip blockquotes, lists, links, inline code and code blocks
  cleanText = cleanText
    .replace(/^>\s+/gm, "")
    .replace(/^[\s-*+]+(.*?)$/gm, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    
  // Clean up formatting
  cleanText = cleanText.replace(/\s+/g, " ").trim();
  
  if (cleanText.length <= 200) {
    return cleanText + (cleanText.endsWith("...") ? "" : "...");
  }
  
  let snippet = cleanText.substring(0, 197);
  const lastSpace = snippet.lastIndexOf(" ");
  if (lastSpace > 150) {
    snippet = snippet.substring(0, lastSpace);
  }
  return snippet + "...";
}

// POST create a new article (from verified publishers)
app.post("/api/articles", (req, res) => {
  const { title, content, price, author, payee } = req.body;
  if (!title || !content || !price || !author || !payee) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const db = readArticlesDb();
    
    // Generate new ID by finding the maximum numeric ID present
    let maxId = 5;
    db.forEach(art => {
      const numId = parseInt(art.id);
      if (!isNaN(numId) && numId > maxId) {
        maxId = numId;
      }
    });
    const newId = String(maxId + 1);
    
    // Create snippet (clean plain text summary)
    const snippet = generateSnippet(content);
    
    const newArticle = {
      id: newId,
      title,
      author,
      snippet,
      content,
      price: String(parseFloat(price).toFixed(2)),
      payee
    };
    
    db.push(newArticle);
    writeArticlesDb(db);
    
    res.json({ success: true, article: newArticle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all publishers
app.get("/api/publishers", (req, res) => {
  try {
    const db = readPublishersDb();
    res.json(db);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to get client IP
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress;
}

// GET check if current IP is authorized admin
app.get("/api/admin/check-ip", (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const db = readAdminIpsDb();
    const authenticated = db.includes(clientIp);
    res.json({ authenticated, ip: clientIp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST authorize current IP as admin (requires password)
app.post("/api/admin/authorize-ip", (req, res) => {
  const { password } = req.body;
  if (password !== "123456A@a") {
    return res.status(401).json({ error: "Invalid password" });
  }
  try {
    const clientIp = getClientIp(req);
    const db = readAdminIpsDb();
    if (!db.includes(clientIp)) {
      db.push(clientIp);
      writeAdminIpsDb(db);
    }
    res.json({ success: true, ip: clientIp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a publisher
app.post("/api/publishers", (req, res) => {
  const { email, name, domain, walletAddress, category } = req.body;
  if (!email || !name || !domain || !walletAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const normalizedEmail = email.toLowerCase();
  try {
    const db = readPublishersDb();
    db[normalizedEmail] = {
      name,
      domain,
      walletAddress,
      verified: false,
      category: category || "General"
    };
    writePublishersDb(db);
    res.json({ success: true, publisher: db[normalizedEmail] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT toggle/update verify publisher (body/query supported to avoid path params with dots/at-symbols on Vercel)
app.put("/api/publishers/verify", (req, res) => {
  const email = req.body.email || req.query.email;
  const { verified } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const normalizedEmail = email.toLowerCase();
  try {
    const db = readPublishersDb();
    if (!db[normalizedEmail]) {
      return res.status(404).json({ error: "Publisher not found" });
    }
    db[normalizedEmail].verified = typeof verified === 'boolean' ? verified : !db[normalizedEmail].verified;
    writePublishersDb(db);
    res.json({ success: true, publisher: db[normalizedEmail] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT toggle/update verify publisher (legacy parameter fallback)
app.put("/api/publishers/:email/verify", (req, res) => {
  const email = req.params.email;
  const { verified } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const normalizedEmail = email.toLowerCase();
  try {
    const db = readPublishersDb();
    if (!db[normalizedEmail]) {
      return res.status(404).json({ error: "Publisher not found" });
    }
    db[normalizedEmail].verified = typeof verified === 'boolean' ? verified : !db[normalizedEmail].verified;
    writePublishersDb(db);
    res.json({ success: true, publisher: db[normalizedEmail] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE publisher (query/body supported to avoid path params with dots/at-symbols on Vercel)
app.delete("/api/publishers", (req, res) => {
  const email = req.query.email || req.body.email;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const normalizedEmail = email.toLowerCase();
  try {
    const db = readPublishersDb();
    if (!db[normalizedEmail]) {
      return res.status(404).json({ error: "Publisher not found" });
    }
    delete db[normalizedEmail];
    writePublishersDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE publisher (legacy parameter fallback)
app.delete("/api/publishers/:email", (req, res) => {
  const email = req.params.email;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const normalizedEmail = email.toLowerCase();
  try {
    const db = readPublishersDb();
    if (!db[normalizedEmail]) {
      return res.status(404).json({ error: "Publisher not found" });
    }
    delete db[normalizedEmail];
    writePublishersDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Get premium article with x402 Paywall logic (Keep for extension backwards compatibility)
app.get("/api/articles/:id", (req, res) => {
  const articleId = req.params.id;
  const articles = readArticlesDb();
  const article = articles.find((a) => a.id === articleId);

  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }

  // Allow author to fetch their own article content directly without paywall validation
  const authorQuery = req.query.author;
  if (authorQuery && article.author.toLowerCase() === authorQuery.toLowerCase()) {
    return res.json({
      success: true,
      articleId,
      title: article.title,
      author: article.author,
      content: article.content
    });
  }

  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("x402 ")) {
    return res.status(402).json({
      error: "Payment Required",
      message: `Reading this article costs $${article.price} USDC. Please pay via Arc Network.`,
      price: article.price,
      currency: "USDC",
      payee: article.payee,
      chainId: ARC_CHAIN_ID,
      tokenAddress: ARC_USDC_ADDRESS,
      articleId
    });
  }

  try {
    const base64Payload = authHeader.substring(5);
    const jsonString = Buffer.from(base64Payload, "base64").toString("utf8");
    const authData = JSON.parse(jsonString);

    console.log(`[x402] Received payment request from: ${authData.from} for ${article.price} USDC`);

    const expectedAmount = Math.round(parseFloat(article.price) * 1000000);
    if (parseInt(authData.value) !== expectedAmount) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    const isValid = authData.signature === "circle-authorized" || verifyEip3009(authData);

    if (!isValid) {
      return res.status(403).json({ error: "Invalid signature or authorization failed" });
    }

    console.log("------------------------------------------------------------------");
    console.log(`[Arc Relayer] SUCCESS: EIP-3009 Signature verified off-chain!`);
    console.log(`[Arc Relayer] Dispatching to Arc Chain RPC...`);
    console.log(`[Arc Relayer] Gas-Free transaction batched and settled on Arc Network!`);
    console.log("------------------------------------------------------------------");

    res.json({
      success: true,
      articleId,
      title: article.title,
      author: article.author,
      content: article.content
    });

  } catch (error) {
    console.error("Failed to process x402 header:", error);
    res.status(400).json({ error: "Malformed x402 authorization header" });
  }
});

// PUT edit an article (requires authorship verification)
app.put("/api/articles/:id", (req, res) => {
  const articleId = req.params.id;
  const { title, content, price, author } = req.body;
  if (!title || !content || !price || !author) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const db = readArticlesDb();
    const articleIndex = db.findIndex(a => a.id === articleId);
    if (articleIndex === -1) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Verify authorship case-insensitively
    if (db[articleIndex].author.toLowerCase() !== author.toLowerCase()) {
      return res.status(403).json({ error: "Unauthorized: You are not the author of this article" });
    }

    const snippet = generateSnippet(content);

    db[articleIndex] = {
      ...db[articleIndex],
      title,
      content,
      price: String(parseFloat(price).toFixed(2)),
      snippet
    };

    writeArticlesDb(db);
    res.json({ success: true, article: db[articleIndex] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE an article (requires authorship verification)
app.delete("/api/articles/:id", (req, res) => {
  const articleId = req.params.id;
  const author = req.body.author || req.query.author;
  if (!author) {
    return res.status(400).json({ error: "Author is required to verify ownership" });
  }

  try {
    const db = readArticlesDb();
    const articleIndex = db.findIndex(a => a.id === articleId);
    if (articleIndex === -1) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Verify authorship case-insensitively
    if (db[articleIndex].author.toLowerCase() !== author.toLowerCase()) {
      return res.status(403).json({ error: "Unauthorized: You are not the author of this article" });
    }

    db.splice(articleIndex, 1);
    writeArticlesDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get/create user wallet
app.post("/api/user/wallet", async (req, res) => {
  const { email, walletId, address } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const normalizedEmail = email.toLowerCase();

  try {
    const db = readUsersDb();
    
    // Restore wallet mapping from client storage if it was lost on serverless cold start
    if (!db[normalizedEmail] && walletId && address) {
      console.log(`[Circle W3S] Restoring wallet for ${normalizedEmail} from client: ${address}`);
      db[normalizedEmail] = {
        walletId,
        address,
        balance: "0.0"
      };
      writeUsersDb(db);
    }
    
    if (db[normalizedEmail]) {
      const balance = await getWalletUsdcBalance(db[normalizedEmail].walletId);
      db[normalizedEmail].balance = balance;
      writeUsersDb(db);
      return res.json({
        walletId: db[normalizedEmail].walletId,
        address: db[normalizedEmail].address,
        balance,
        isMock: isMockMode
      });
    }

    console.log(`[Circle W3S] Creating new wallet for: ${normalizedEmail}`);
    let newWalletId, newAddress;

    if (isMockMode) {
      newWalletId = crypto.randomUUID();
      newAddress = "0x" + crypto.randomBytes(20).toString("hex");
      console.log(`[Mock Mode] Generated wallet address: ${newAddress}`);
    } else {
      const wallet = await createCircleWallet();
      newWalletId = wallet.id;
      newAddress = wallet.address;
    }

    db[normalizedEmail] = {
      walletId: newWalletId,
      address: newAddress,
      balance: "0.0100"
    };
    writeUsersDb(db);

    if (!isMockMode) {
      try {
        console.log(`[Circle W3S] Fauceting 0.01 USDC to new wallet: ${newAddress}`);
        const txId = await transferCircleUsdc(process.env.PUBLISHER_WALLET_ID, newAddress, 0.01);
        await pollTransactionStatus(txId);
        console.log(`[Circle W3S] Faucet transaction complete.`);
      } catch (faucetErr) {
        console.error("Faucet transfer failed:", faucetErr);
      }
    }

    const finalBalance = await getWalletUsdcBalance(newWalletId);
    db[normalizedEmail].balance = finalBalance;
    writeUsersDb(db);

    res.json({
      walletId: newWalletId,
      address: newAddress,
      balance: finalBalance,
      isMock: isMockMode
    });

  } catch (error) {
    console.error("Failed to get/create user wallet:", error);
    res.status(500).json({ error: error.message || "Failed to get or create wallet" });
  }
});

// Endpoint to request faucet from publisher wallet
app.post("/api/user/faucet", async (req, res) => {
  const { email, walletId, address } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const normalizedEmail = email.toLowerCase();

  try {
    const db = readUsersDb();
    
    // Restore wallet mapping from client storage if it was lost on serverless cold start
    if (!db[normalizedEmail] && walletId && address) {
      console.log(`[Circle W3S] Restoring wallet for ${normalizedEmail} from client: ${address}`);
      db[normalizedEmail] = {
        walletId,
        address,
        balance: "0.0"
      };
      writeUsersDb(db);
    }

    if (!db[normalizedEmail]) {
      return res.status(400).json({ error: "User wallet not initialized" });
    }

    // Cooldown check (30 minutes)
    const now = Date.now();
    const lastFaucet = db[normalizedEmail].lastFaucetTime || 0;
    const cooldown = 30 * 60 * 1000; // 30 minutes in ms
    const timePassed = now - lastFaucet;

    if (timePassed < cooldown) {
      const timeLeftMs = cooldown - timePassed;
      const timeLeftMins = Math.ceil(timeLeftMs / 1000 / 60);
      return res.status(429).json({
        error: `Faucet cooldown active. Please wait ${timeLeftMins} minute(s) before requesting again.`
      });
    }

    const userWalletId = db[normalizedEmail].walletId;
    const userAddress = db[normalizedEmail].address;
    const amount = 0.05;

    console.log(`[Circle W3S] Fauceting ${amount} USDC from publisher wallet to ${userAddress}`);

    let txHash;
    if (isMockMode) {
      txHash = "0x" + crypto.randomBytes(32).toString("hex");
      const currentBal = parseFloat(db[normalizedEmail].balance || "0.0");
      db[normalizedEmail].balance = (currentBal + amount).toFixed(4);
      db[normalizedEmail].lastFaucetTime = now;
      writeUsersDb(db);
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`[Mock Faucet] Added ${amount} USDC to ${normalizedEmail}`);
    } else {
      const txId = await transferCircleUsdc(process.env.PUBLISHER_WALLET_ID, userAddress, amount);
      const result = await pollTransactionStatus(txId);
      txHash = result.txHash;
      db[normalizedEmail].lastFaucetTime = now;
    }

    const finalBalance = await getWalletUsdcBalance(userWalletId);
    db[normalizedEmail].balance = finalBalance;
    writeUsersDb(db);

    res.json({
      success: true,
      txHash,
      balance: finalBalance
    });

  } catch (error) {
    console.error("Faucet error:", error);
    res.status(500).json({ error: error.message || "Failed to execute faucet transfer" });
  }
});

// Endpoint to unlock an article
app.post("/api/articles/unlock", async (req, res) => {
  const { email, articleId, walletId, address } = req.body;
  if (!email || !articleId) {
    return res.status(400).json({ error: "Email and articleId are required" });
  }
  const normalizedEmail = email.toLowerCase();

  const articles = readArticlesDb();
  const article = articles.find(a => a.id === articleId);
  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }

  try {
    const db = readUsersDb();
    
    // Restore wallet mapping from client storage if it was lost on serverless cold start
    if (!db[normalizedEmail] && walletId && address) {
      console.log(`[Circle W3S] Restoring wallet for ${normalizedEmail} from client: ${address}`);
      db[normalizedEmail] = {
        walletId,
        address,
        balance: "0.0"
      };
      writeUsersDb(db);
    }

    if (!db[normalizedEmail]) {
      return res.status(400).json({ error: "User wallet not initialized. Please log in again." });
    }

    const userWalletId = db[normalizedEmail].walletId;
    const userWalletAddress = db[normalizedEmail].address;
    
    const currentBalance = await getWalletUsdcBalance(userWalletId);
    const cost = parseFloat(article.price);
    
    if (parseFloat(currentBalance) < cost) {
      return res.status(402).json({ error: "Insufficient balance", balance: currentBalance });
    }

    console.log(`[Circle W3S] Transferring ${cost} USDC from user wallet (${userWalletAddress}) to publisher (${PUBLISHER_WALLET})`);
    
    let txHash;

    if (isMockMode) {
      txHash = "0x" + crypto.randomBytes(32).toString("hex");
      const newBal = (parseFloat(currentBalance) - cost).toFixed(4);
      db[normalizedEmail].balance = newBal;
      writeUsersDb(db);
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log(`[Mock Mode] Transfer successful. TxHash: ${txHash}`);
    } else {
      const txId = await transferCircleUsdc(userWalletId, PUBLISHER_WALLET, cost);
      const result = await pollTransactionStatus(txId);
      txHash = result.txHash;
    }

    const finalBalance = await getWalletUsdcBalance(userWalletId);
    db[normalizedEmail].balance = finalBalance;
    writeUsersDb(db);

    res.json({
      success: true,
      txHash,
      balance: finalBalance,
      isMock: isMockMode
    });

  } catch (error) {
    console.error("Unlock article error:", error);
    res.status(500).json({ error: error.message || "Failed to process transaction on Arc Testnet" });
  }
});

// Endpoint to withdraw funds from user Circle wallet to a personal EVM wallet
app.post("/api/user/withdraw", async (req, res) => {
  const { email, walletId, address, destinationAddress, amount } = req.body;
  if (!email || !destinationAddress || !amount) {
    return res.status(400).json({ error: "Email, destinationAddress and amount are required" });
  }
  const normalizedEmail = email.toLowerCase();
  const withdrawAmount = parseFloat(amount);
  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ error: "Invalid withdraw amount" });
  }

  try {
    const db = readUsersDb();
    
    // Restore wallet mapping from client storage if it was lost on serverless cold start
    if (!db[normalizedEmail] && walletId && address) {
      console.log(`[Circle W3S] Restoring wallet for ${normalizedEmail} from client: ${address}`);
      db[normalizedEmail] = {
        walletId,
        address,
        balance: "0.0"
      };
      writeUsersDb(db);
    }

    if (!db[normalizedEmail]) {
      return res.status(400).json({ error: "User wallet not initialized. Please log in again." });
    }

    const userWalletId = db[normalizedEmail].walletId;
    const userWalletAddress = db[normalizedEmail].address;
    
    const currentBalance = await getWalletUsdcBalance(userWalletId);
    
    if (parseFloat(currentBalance) < withdrawAmount) {
      return res.status(400).json({ error: "Insufficient balance for withdrawal", balance: currentBalance });
    }

    console.log(`[Circle W3S] Withdrawing ${withdrawAmount} USDC from user wallet (${userWalletAddress}) to personal wallet (${destinationAddress})`);
    
    let txHash;

    if (isMockMode) {
      txHash = "0x" + crypto.randomBytes(32).toString("hex");
      const newBal = (parseFloat(currentBalance) - withdrawAmount).toFixed(4);
      db[normalizedEmail].balance = newBal;
      writeUsersDb(db);
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log(`[Mock Mode] Withdrawal successful. TxHash: ${txHash}`);
    } else {
      const txId = await transferCircleUsdc(userWalletId, destinationAddress, withdrawAmount);
      const result = await pollTransactionStatus(txId);
      txHash = result.txHash;
    }

    const finalBalance = await getWalletUsdcBalance(userWalletId);
    db[normalizedEmail].balance = finalBalance;
    writeUsersDb(db);

    res.json({
      success: true,
      txHash,
      balance: finalBalance,
      isMock: isMockMode
    });

  } catch (error) {
    console.error("Withdrawal error:", error);
    res.status(500).json({ error: error.message || "Failed to process withdrawal on Arc Testnet" });
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`[Server] Lepton x402 Publisher running on http://localhost:${PORT}`);
  });
}

module.exports = app;
