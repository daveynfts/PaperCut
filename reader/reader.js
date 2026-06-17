const BACKEND_URL = "http://localhost:4000";

let extensionId = "";
let walletConnected = false;
let currentArticles = [];
let selectedArticle = null;

// DOM Elements
const extIdInput = document.getElementById("ext-id-input");
const btnConnect = document.getElementById("btn-connect");
const walletStatus = document.getElementById("wallet-status");
const walletAddrText = document.getElementById("wallet-addr-text");
const feedCountEl = document.getElementById("feed-count");
const articleListEl = document.getElementById("article-list");

const viewerDefault = document.getElementById("viewer-default");
const viewerActive = document.getElementById("viewer-active");
const activeTitle = document.getElementById("active-title");
const activeAuthor = document.getElementById("active-author");
const activePriceTag = document.getElementById("active-price-tag");
const articleContentFree = document.getElementById("article-content-free");
const paywallModule = document.getElementById("paywall-module");
const paywallPrice = document.getElementById("paywall-price");
const btnUnlock = document.getElementById("btn-unlock");
const paywallError = document.getElementById("paywall-error");
const articleContentPremium = document.getElementById("article-content-premium");

// Load Extension ID from local storage
if (localStorage.getItem("lepton_extension_id")) {
  extensionId = localStorage.getItem("lepton_extension_id");
  extIdInput.value = extensionId;
  connectExtension();
}

// Connect Extension button handler
btnConnect.addEventListener("click", () => {
  extensionId = extIdInput.value.trim();
  if (extensionId) {
    localStorage.setItem("lepton_extension_id", extensionId);
    connectExtension();
  }
});

// Attempt to ping the extension background worker
function connectExtension() {
  if (!extensionId) return;

  chrome.runtime.sendMessage(extensionId, { type: "GET_WALLET_INFO" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("Failed to connect to extension:", chrome.runtime.lastError.message);
      setWalletDisconnected("Extension ID invalid or extension not running");
      return;
    }

    if (response && response.success) {
      walletConnected = true;
      walletStatus.classList.add("connected");
      walletAddrText.textContent = shortenAddress(response.address);
      walletAddrText.title = `Connected address: ${response.address}\nBalance: ${response.balance.toFixed(2)} USDC\nDaily Spent: ${response.spentToday.toFixed(2)} / ${response.dailyLimit.toFixed(2)} USDC`;
      console.log("[Lepton Reader] Connected to wallet:", response.address);
    } else {
      setWalletDisconnected(response ? response.error : "Unknown wallet state");
    }
  });
}

function setWalletDisconnected(reason) {
  walletConnected = false;
  walletStatus.classList.remove("connected");
  walletAddrText.textContent = "No Wallet Connected";
  walletAddrText.title = reason || "Not connected";
}

function shortenAddress(addr) {
  return addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
}

// Fetch Article feed list from Backend
async function fetchFeed() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/articles`);
    const data = await response.json();
    currentArticles = data;
    renderFeedList(data);
  } catch (error) {
    console.error("Failed to fetch feed:", error);
    articleListEl.innerHTML = `<div class="loading-spinner" style="color: #ff5252;">Failed to load feed from publisher. Make sure backend is running.</div>`;
  }
}

// Render Feed list inside left sidebar
function renderFeedList(articles) {
  feedCountEl.textContent = `${articles.length} articles`;

  if (articles.length === 0) {
    articleListEl.innerHTML = `<div class="loading-spinner">No articles found.</div>`;
    return;
  }

  articleListEl.innerHTML = articles
    .map(
      (art) => `
      <div class="article-card" id="card-${art.id}" onclick="selectArticle('${art.id}')">
        <div class="card-title">${art.title}</div>
        <div class="card-meta">
          <span>By ${art.author}</span>
          <span class="price-tag">$${art.price} USDC</span>
        </div>
        <div class="card-snippet">${art.snippet}</div>
      </div>
    `
    )
    .join("");
}

// Fetch and view a specific article
async function selectArticle(id) {
  // Update active state in sidebar
  document.querySelectorAll(".article-card").forEach((card) => card.classList.remove("active"));
  const cardEl = document.getElementById(`card-${id}`);
  if (cardEl) cardEl.classList.add("active");

  selectedArticle = currentArticles.find((a) => a.id === id);

  viewerDefault.style.display = "none";
  viewerActive.style.display = "block";
  paywallModule.style.display = "none";
  paywallError.style.display = "none";
  articleContentPremium.style.display = "none";

  activeTitle.textContent = selectedArticle.title;
  activeAuthor.textContent = selectedArticle.author;
  activePriceTag.textContent = `$${selectedArticle.price} USDC`;

  // Fetch from server
  try {
    const response = await fetch(`${BACKEND_URL}/api/articles/${id}`);
    
    if (response.status === 200) {
      // Free or already paid article
      const data = await response.json();
      articleContentFree.textContent = data.content;
      articleContentPremium.style.display = "none";
    } else if (response.status === 402) {
      // Paywall required
      const data = await response.json();
      articleContentFree.textContent = selectedArticle.snippet;
      
      paywallPrice.textContent = `$${data.price} USDC`;
      paywallModule.style.display = "block";

      // Configure unlock button
      btnUnlock.onclick = () => unlockArticle(data);
    }
  } catch (error) {
    console.error("Error fetching article:", error);
  }
}

// Request extension to sign and unlock article
async function unlockArticle(paywallData) {
  paywallError.style.display = "none";

  if (!walletConnected) {
    showPaywallError("Please input your Extension ID above and click 'Connect' first.");
    return;
  }

  btnUnlock.textContent = "Unlocking...";
  btnUnlock.disabled = true;

  // Send request signature message to Chrome Extension
  chrome.runtime.sendMessage(
    extensionId,
    {
      type: "REQUEST_SIGNATURE",
      data: {
        payee: paywallData.payee,
        amountUsdc: paywallData.price,
        articleId: paywallData.articleId,
        title: selectedArticle.title
      }
    },
    async (response) => {
      btnUnlock.textContent = "Unlock Article";
      btnUnlock.disabled = false;

      if (chrome.runtime.lastError) {
        showPaywallError(`Extension connection lost: ${chrome.runtime.lastError.message}`);
        return;
      }

      if (!response.success) {
        showPaywallError(`Wallet Error: ${response.error === "LIMIT_EXCEEDED" ? response.message : response.error}`);
        return;
      }

      // Success: We got the EIP-3009 signature payload!
      const paymentPayload = {
        from: response.from,
        to: response.to,
        value: response.value,
        validAfter: response.validAfter,
        validBefore: response.validBefore,
        nonce: response.nonce,
        signature: response.signature
      };

      // Base64 encode the JSON payload to send in the HTTP header
      const base64Header = btoa(JSON.stringify(paymentPayload));

      try {
        const unlockResponse = await fetch(`${BACKEND_URL}/api/articles/${paywallData.articleId}`, {
          headers: {
            "Authorization": `x402 ${base64Header}`
          }
        });

        const data = await unlockResponse.json();

        if (unlockResponse.status === 200 && data.success) {
          // Paywall cleared! Render full article
          paywallModule.style.display = "none";
          articleContentFree.style.display = "none";
          articleContentPremium.textContent = data.content;
          articleContentPremium.style.display = "block";
          
          // Refresh wallet status to sync balances
          connectExtension();
        } else {
          showPaywallError(data.error || "Failed to unlock article on the server.");
        }
      } catch (err) {
        console.error("Unlock request failed:", err);
        showPaywallError("Network error while submitting proof of payment.");
      }
    }
  );
}

function showPaywallError(msg) {
  paywallError.textContent = msg;
  paywallError.style.display = "block";
}

// Initial feed fetch
fetchFeed();
