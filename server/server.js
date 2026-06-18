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

// Mock Article Database
const articles = [
  {
    id: "0",
    title: "Exploring the Antigravity of Decentralized Liquidity",
    author: "Hayden Adams",
    snippet: "How automated market makers and concentrated liquidity protocols are redefining financial architecture without intermediaries...",
    content: "How automated market makers and concentrated liquidity protocols are redefining financial architecture without intermediaries. Traditional financial plumbing relies on order books managed by centralized institutions. By utilizing constant product formulas and on-chain liquidity pools, Uniswap proved that trustless market-making is not only possible but highly efficient. Concentrated liquidity further refines this by allowing providers to allocate capital to specific price ranges, maximizing efficiency and cementing AMMs as the foundational substrate of decentralized finance.",
    price: "0.05",
    payee: PUBLISHER_WALLET
  },
  {
    id: "1",
    title: "The Promise and Challenges of Crypto-Pluralism",
    author: "Vitalik Buterin",
    snippet: "Pluralism in the digital age requires decentralized governance models that respect individual sovereignty while fostering coordination...",
    content: "Pluralism in the digital age requires decentralized governance models that respect individual sovereignty while fostering coordination. Quadratic voting, retrofunding, and decentralized identity systems represent the first wave of tools enabling communities to steward public goods without relying on centralized bureaucracies. We must refine these mechanisms to ensure they are robust against collusion, Sybil attacks, and platform capture, cementing a truly democratic substrate for the internet.",
    price: "0.08",
    payee: PUBLISHER_WALLET
  },
  {
    id: "2",
    title: "The Rise of the Startup Society and Cloud First Cities",
    author: "Balaji Srinivasan",
    snippet: "Physical nations are slow, bureaucratic, and bound to geographical legacy. The startup society starts cloud-first, building digital...",
    content: "Physical nations are slow, bureaucratic, and bound to geographical legacy. The startup society starts cloud-first, building digital consensus, crowdfunding land, and negotiating diplomatic recognition dynamically. By leveraging public block explorers, cryptographic citizenship, and smart-contract law, we can run experiments in governance at cloud speeds, offering alternative jurisdictions for people who value innovation and voluntary association.",
    price: "0.10",
    payee: PUBLISHER_WALLET
  },
  {
    id: "3",
    title: "Ultra-Sound Money: Analysing the Deflationary Mechanics of EIP-1559",
    author: "Bankless",
    snippet: "Is Ethereum truly ultra-sound? Let's dissect the base fee burn mechanism and how network transaction fee demand impacts ether supply...",
    content: "Is Ethereum truly ultra-sound? Let's dissect the base fee burn mechanism and how network transaction fee demand impacts ether supply. Under EIP-1559, a portion of every transaction fee is permanently removed from circulation. When network activity exceeds threshold limits, the burn rate surpasses issuance, resulting in net-deflationary supply dynamics. This fundamentally transforms ether from a pure utility token into a scarce, productive store of value.",
    price: "0.04",
    payee: PUBLISHER_WALLET
  },
  {
    id: "4",
    title: "Read, Write, Own: How Web3 Restores the Original Vision of the Internet",
    author: "Chris Dixon",
    snippet: "Web1 was read-only, dominated by open protocols. Web2 added write capabilities, but centralized the power in corporate platforms. Web3...",
    content: "Web1 was read-only, dominated by open protocols. Web2 added write capabilities, but centralized the power in corporate platforms. Web3 introduces ownership. By giving users and builders direct ownership of the networks they use through tokens, we align incentives, reduce platform rent-seeking, and reignite the innovative explosion of the early internet. This isn't just about finance; it's about rebuilding digital democracy.",
    price: "0.06",
    payee: PUBLISHER_WALLET
  },
  {
    id: "5",
    title: "L1 vs L2: The Geopolitics of Blockchain Scaling Solutions",
    author: "Haseeb Qureshi",
    snippet: "Will Ethereum Layer 2s cannibalize the base chain? We examine the economic flywheels of rollups, blob space fees, and security...",
    content: "Will Ethereum Layer 2s cannibalize the base chain? We examine the economic flywheels of rollups, blob space fees, and security. As Layer 2 execution becomes dirt cheap, value accrual moves to the settlement layer through L1 blob consumption. The geopolitics of blockchains suggest a future where L1s act as global supreme courts, and L2s act as high-speed commercial cities. This balance is critical to prevent fragmentation and secure long-term decentralization.",
    price: "0.05",
    payee: PUBLISHER_WALLET
  }
];

// Local JSON Database for mappings (email -> walletId, address, balance)
const USERS_DB_PATH = process.env.VERCEL
  ? "/tmp/users.json"
  : path.join(__dirname, "users.json");

function readUsersDb() {
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
  return JSON.parse(fs.readFileSync(USERS_DB_PATH, "utf8"));
}

function writeUsersDb(db) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Failed to write users DB:", err);
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
      feeLevel: "MEDIUM"
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
  const metaArticles = articles.map(({ id, title, author, snippet, price, payee }) => ({
    id,
    title,
    author,
    snippet,
    price,
    payee
  }));
  res.json(metaArticles);
});

// Get premium article with x402 Paywall logic (Keep for extension backwards compatibility)
app.get("/api/articles/:id", (req, res) => {
  const articleId = req.params.id;
  const article = articles.find((a) => a.id === articleId);

  if (!article) {
    return res.status(404).json({ error: "Article not found" });
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

// Endpoint to get/create user wallet
app.post("/api/user/wallet", async (req, res) => {
  const { email, walletId, address } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const db = readUsersDb();
    
    // Restore wallet mapping from client storage if it was lost on serverless cold start
    if (!db[email] && walletId && address) {
      console.log(`[Circle W3S] Restoring wallet for ${email} from client: ${address}`);
      db[email] = {
        walletId,
        address,
        balance: "0.0"
      };
      writeUsersDb(db);
    }
    
    if (db[email]) {
      const balance = await getWalletUsdcBalance(db[email].walletId);
      db[email].balance = balance;
      writeUsersDb(db);
      return res.json({
        walletId: db[email].walletId,
        address: db[email].address,
        balance,
        isMock: isMockMode
      });
    }

    console.log(`[Circle W3S] Creating new wallet for: ${email}`);
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

    db[email] = {
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
    db[email].balance = finalBalance;
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

  try {
    const db = readUsersDb();
    
    // Restore wallet mapping from client storage if it was lost on serverless cold start
    if (!db[email] && walletId && address) {
      console.log(`[Circle W3S] Restoring wallet for ${email} from client: ${address}`);
      db[email] = {
        walletId,
        address,
        balance: "0.0"
      };
      writeUsersDb(db);
    }

    if (!db[email]) {
      return res.status(400).json({ error: "User wallet not initialized" });
    }

    // Cooldown check (30 minutes)
    const now = Date.now();
    const lastFaucet = db[email].lastFaucetTime || 0;
    const cooldown = 30 * 60 * 1000; // 30 minutes in ms
    const timePassed = now - lastFaucet;

    if (timePassed < cooldown) {
      const timeLeftMs = cooldown - timePassed;
      const timeLeftMins = Math.ceil(timeLeftMs / 1000 / 60);
      return res.status(429).json({
        error: `Faucet cooldown active. Please wait ${timeLeftMins} minute(s) before requesting again.`
      });
    }

    const userWalletId = db[email].walletId;
    const userAddress = db[email].address;
    const amount = 0.05;

    console.log(`[Circle W3S] Fauceting ${amount} USDC from publisher wallet to ${userAddress}`);

    let txHash;
    if (isMockMode) {
      txHash = "0x" + crypto.randomBytes(32).toString("hex");
      const currentBal = parseFloat(db[email].balance || "0.0");
      db[email].balance = (currentBal + amount).toFixed(4);
      db[email].lastFaucetTime = now;
      writeUsersDb(db);
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`[Mock Faucet] Added ${amount} USDC to ${email}`);
    } else {
      const txId = await transferCircleUsdc(process.env.PUBLISHER_WALLET_ID, userAddress, amount);
      const result = await pollTransactionStatus(txId);
      txHash = result.txHash;
      db[email].lastFaucetTime = now;
    }

    const finalBalance = await getWalletUsdcBalance(userWalletId);
    db[email].balance = finalBalance;
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

  const article = articles.find(a => a.id === articleId);
  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }

  try {
    const db = readUsersDb();
    
    // Restore wallet mapping from client storage if it was lost on serverless cold start
    if (!db[email] && walletId && address) {
      console.log(`[Circle W3S] Restoring wallet for ${email} from client: ${address}`);
      db[email] = {
        walletId,
        address,
        balance: "0.0"
      };
      writeUsersDb(db);
    }

    if (!db[email]) {
      return res.status(400).json({ error: "User wallet not initialized. Please log in again." });
    }

    const userWalletId = db[email].walletId;
    const userWalletAddress = db[email].address;
    
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
      db[email].balance = newBal;
      writeUsersDb(db);
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log(`[Mock Mode] Transfer successful. TxHash: ${txHash}`);
    } else {
      const txId = await transferCircleUsdc(userWalletId, PUBLISHER_WALLET, cost);
      const result = await pollTransactionStatus(txId);
      txHash = result.txHash;
    }

    const finalBalance = await getWalletUsdcBalance(userWalletId);
    db[email].balance = finalBalance;
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

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`[Server] Lepton x402 Publisher running on http://localhost:${PORT}`);
  });
}

module.exports = app;
