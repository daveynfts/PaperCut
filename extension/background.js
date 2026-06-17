// Background service worker for Lepton Wallet Chrome Extension

const BACKEND_URL = "http://localhost:4000";

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
  const data = await getStorageData(["email", "circleAddress", "circleBalance", "dailyLimit", "spentToday"]);
  if (!data.email || !data.circleAddress) {
    sendResponse({ success: false, error: "Wallet not connected. Open the extension popup to connect your Gmail." });
    return;
  }

  sendResponse({
    success: true,
    address: data.circleAddress,
    balance: data.circleBalance || 0,
    dailyLimit: data.dailyLimit || 0.10,
    spentToday: data.spentToday || 0.00
  });
}

// 2. Handle EIP-3009 Signature Request with Auto-Sign Budget logic using Circle backend
async function handleRequestSignature(data, sendResponse) {
  const { payee, amountUsdc, articleId, title } = data;
  const price = parseFloat(amountUsdc);

  const storage = await getStorageData(["email", "circleAddress", "circleBalance", "dailyLimit", "spentToday", "transactions"]);
  
  if (!storage.email || !storage.circleAddress) {
    sendResponse({ success: false, error: "Wallet not connected. Open the extension popup to connect your Gmail." });
    return;
  }

  const currentBalance = storage.circleBalance || 0;
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
      message: `Paying $${price.toFixed(4)} USDC exceeds your daily cap of $${currentLimit.toFixed(2)} USDC. Please authorize manually.`
    });
    return;
  }

  try {
    const microUsdcValue = Math.round(price * 1000000);
    
    console.log(`[Extension Background] Requesting backend to unlock article ${articleId} for ${storage.email}...`);

    // Call backend to execute the transfer on-chain via Circle Developer-Controlled wallets
    const response = await fetch(`${BACKEND_URL}/api/articles/unlock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: storage.email,
        articleId: articleId
      })
    });

    const result = await response.json();
    if (!response.ok) {
      sendResponse({ success: false, error: result.error || "Failed to unlock article via Circle backend." });
      return;
    }

    console.log(`[Extension Background] Backend unlock successful. New balance: ${result.balance}`);

    // Update wallet state in storage
    const newBalance = parseFloat(result.balance);
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
        circleBalance: newBalance,
        spentToday: newSpent,
        transactions: txs,
        lastSpentDate: new Date().toDateString()
      }, resolve);
    });

    // Return the response back to the website with circle-authorized bypass tag
    sendResponse({
      success: true,
      from: storage.circleAddress,
      to: payee,
      value: microUsdcValue.toString(),
      validAfter: 0,
      validBefore: 0,
      nonce: "0x",
      signature: "circle-authorized" // Bypassed signature tag
    });

  } catch (error) {
    console.error("Circle backend payment execution failed:", error);
    sendResponse({ success: false, error: "SIGNING_FAILED" });
  }
}
