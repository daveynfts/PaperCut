const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Mock Publisher Wallet Address (Recipient of micropayments)
const PUBLISHER_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Hardhat #0

// Mock USDC Contract Address on Arc L1
const ARC_USDC_ADDRESS = "0x0000000000000000000000000000000000001010"; // Mock USDC
const ARC_CHAIN_ID = 54321; // Mock Arc ChainID

// Mock Article Database
const articles = [
  {
    id: "1",
    title: "The Rebirth of the Lepton: Why Nanopayments are the Future of Web3",
    author: "Alice Sterling",
    snippet: "For decades, subscription models have forced users to pay for bundled content. But what if you could pay $0.02 to read a single article...",
    content: "For decades, subscription models have forced users to pay for bundled content. But what if you could pay $0.02 to read a single article? Nanopayments remove the floor. Using Circle's Arc network and EIP-3009 off-chain signatures, we can settle value as small as $0.000001 instantly and gaslessly. This enables creators to sell individual articles, songs, or photos directly to users, opening up a new long-tail economy that subscriptions priced out.",
    price: "0.02", // in USDC
    payee: PUBLISHER_WALLET
  },
  {
    id: "2",
    title: "AI-Agent Economies: How Bots Earn and Spend on the Arc Blockchain",
    author: "Bob Vances",
    snippet: "AI agents are no longer just tools; they are economic actors. By equipping LLMs with programmable wallets, they can autonomously pay...",
    content: "AI agents are no longer just tools; they are economic actors. By equipping LLMs with programmable wallets, they can autonomously pay for APIs, compute, and premium data feeds per request. On the Arc network, an agent can pay $0.001 to summarize a paragraph or $0.01 to generate an image. This eliminates subscription overhead, allowing agents to route request queries to the cheapest, fastest providers dynamically on a strict daily budget.",
    price: "0.05",
    payee: PUBLISHER_WALLET
  },
  {
    id: "3",
    title: "Decentralized GPU Markets: Renting Compute by the Millisecond",
    author: "Charlie Hacker",
    snippet: "Renting GPUs usually requires high deposit minimums. Continuous payment streams on Arc allow renting GPU compute by the second...",
    content: "Renting GPUs usually requires high deposit minimums. Continuous payment streams on Arc allow renting GPU compute by the second. A user opens a payment channel that streams $0.0001 USDC per second to the provider. The moment the computation finishes, the connection terminates, the payment stops, and the user is only billed for the exact seconds of server runtime used. This maximizes utility for fine-tuning models and batch processing.",
    price: "0.03",
    payee: PUBLISHER_WALLET
  }
];

// Helper to verify EIP-3009 TransferWithAuthorization signature
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

    // Recover signer address from signature
    const recoveredAddress = ethers.verifyTypedData(domain, types, valueData, signature);
    
    // Check if recovered address matches the sender (from)
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

// Get premium article with x402 Paywall logic
app.get("/api/articles/:id", (req, res) => {
  const articleId = req.params.id;
  const article = articles.find((a) => a.id === articleId);

  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }

  const authHeader = req.headers["authorization"];

  // 1. Missing or invalid Auth Header -> Return HTTP 402 Payment Required
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

  // 2. Decode the Base64 auth payload
  try {
    const base64Payload = authHeader.substring(5); // Remove "x402 "
    const jsonString = Buffer.from(base64Payload, "base64").toString("utf8");
    const authData = JSON.parse(jsonString);

    console.log(`[x402] Received payment request from: ${authData.from} for ${article.price} USDC`);

    // Verify amount matches the article price (convert to USDC 6 decimals)
    const expectedAmount = Math.round(parseFloat(article.price) * 1000000);
    if (parseInt(authData.value) !== expectedAmount) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    // Verify EIP-3009 Signature off-chain
    const isValid = verifyEip3009(authData);

    if (!isValid) {
      return res.status(403).json({ error: "Invalid signature or authorization failed" });
    }

    // 3. Signature verified -> Simulate dispatching to Arc blockchain
    console.log("------------------------------------------------------------------");
    console.log(`[Arc Relayer] SUCCESS: EIP-3009 Signature verified off-chain!`);
    console.log(`[Arc Relayer] Dispatching to Arc Chain RPC...`);
    console.log(`Contract: USDC.transferWithAuthorization(`);
    console.log(`  from: ${authData.from},`);
    console.log(`  to: ${authData.to},`);
    console.log(`  value: ${authData.value},`);
    console.log(`  validAfter: ${authData.validAfter},`);
    console.log(`  validBefore: ${authData.validBefore},`);
    console.log(`  nonce: ${authData.nonce},`);
    console.log(`  signature: ${authData.signature.substring(0, 15)}...`);
    console.log(`);`);
    console.log(`[Arc Relayer] Gas-Free transaction batched and settled on Arc Network!`);
    console.log("------------------------------------------------------------------");

    // Return full article content
    res.json({
      success: true,
      articleId,
      title: article.title,
      author: article.author,
      content: article.content
    });

  } catch (error) {
    console.error("Failed to process x402 header:", error);
    return res.status(400).json({ error: "Malformed x402 authorization header" });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Lepton x402 Publisher running on http://localhost:${PORT}`);
});
