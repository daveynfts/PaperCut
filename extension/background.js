// Load ethers.js in the Manifest V3 service worker context
importScripts("ethers.umd.min.js");

const ARC_CHAIN_ID = 54321;
const ARC_USDC_ADDRESS = "0x0000000000000000000000000000000000001010";

// Helper to get raw Chrome storage data asynchronously
function getStorageData(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

// Listen for external messages (from verified website)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log("[Lepton Background] Received request:", request);

  if (request.type === "GET_WALLET_INFO") {
    handleGetWalletInfo(sendResponse);
    return true; // Keep message channel open for async response
  }

  if (request.type === "REQUEST_SIGNATURE") {
    handleRequestSignature(request.data, sendResponse);
    return true; // Keep message channel open for async response
  }

  sendResponse({ success: false, error: "Unknown request type" });
});

// 1. Handle Wallet Info queries
async function handleGetWalletInfo(sendResponse) {
  const data = await getStorageData(["privateKey", "balance", "dailyLimit", "spentToday"]);
  if (!data.privateKey) {
    sendResponse({ success: false, error: "Wallet not initialized" });
    return;
  }

  const wallet = new ethers.Wallet(data.privateKey);
  sendResponse({
    success: true,
    address: wallet.address,
    balance: data.balance || 0,
    dailyLimit: data.dailyLimit || 0.10,
    spentToday: data.spentToday || 0.00
  });
}

// 2. Handle EIP-3009 Signature Request with Auto-Sign Budget logic
async function handleRequestSignature(data, sendResponse) {
  const { payee, amountUsdc, articleId, title } = data;
  const price = parseFloat(amountUsdc);

  const storage = await getStorageData(["privateKey", "balance", "dailyLimit", "spentToday", "transactions"]);
  
  if (!storage.privateKey) {
    sendResponse({ success: false, error: "Wallet not initialized" });
    return;
  }

  const wallet = new ethers.Wallet(storage.privateKey);
  const currentBalance = storage.balance || 0;
  const currentLimit = storage.dailyLimit || 0.10;
  const currentSpent = storage.spentToday || 0.00;
  const txs = storage.transactions || [];

  // Check 1: Check balance
  if (currentBalance < price) {
    sendResponse({ success: false, error: "INSUFFICIENT_BALANCE" });
    return;
  }

  // Check 2: Check daily limit cap
  if (currentSpent + price > currentLimit) {
    sendResponse({ 
      success: false, 
      error: "LIMIT_EXCEEDED", 
      message: `Paying $${price.toFixed(2)} USDC exceeds your daily cap of $${currentLimit.toFixed(2)} USDC. Please authorize manually.`
    });
    return;
  }

  try {
    // USDC uses 6 decimals (1 USDC = 1,000,000 micro-USDC)
    const microUsdcValue = Math.round(price * 1000000);
    
    // Generate valid EIP-3009 arguments
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiry
    const nonce = ethers.hexlify(ethers.randomBytes(32));

    // EIP-712 Domain Separator
    const domain = {
      name: "USD Coin",
      version: "2",
      chainId: ARC_CHAIN_ID,
      verifyingContract: ARC_USDC_ADDRESS
    };

    // EIP-3009 Types Definition
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

    // Message payload
    const message = {
      from: wallet.address,
      to: payee,
      value: BigInt(microUsdcValue),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce
    };

    // Cryptographic signing on Arc L1 config
    const signature = await wallet.signTypedData(domain, types, message);

    // Update wallet state in storage
    const newBalance = currentBalance - price;
    const newSpent = currentSpent + price;
    
    const newTx = {
      articleId,
      title,
      amount: price,
      timestamp: Date.now()
    };
    txs.push(newTx);

    await new Promise((resolve) => {
      chrome.storage.local.set({
        balance: newBalance,
        spentToday: newSpent,
        transactions: txs,
        lastSpentDate: new Date().toDateString()
      }, resolve);
    });

    // Return the EIP-3009 authentication block back to the website
    sendResponse({
      success: true,
      from: wallet.address,
      to: payee,
      value: microUsdcValue.toString(),
      validAfter,
      validBefore,
      nonce,
      signature
    });

  } catch (error) {
    console.error("Signing failed in extension backend worker:", error);
    sendResponse({ success: false, error: "SIGNING_FAILED" });
  }
}
