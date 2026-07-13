// Mock Article Database (Keep in client-side memory)
const articles = [
  {
    id: "1",
    title: "The Rebirth of the Lepton: Why Nanopayments are the Future of Web3",
    author: "Alice Sterling",
    snippet: "For decades, subscription models have forced users to pay for bundled content. But what if you could pay $0.02 to read a single article...",
    content: "For decades, subscription models have forced users to pay for bundled content. But what if you could pay $0.02 to read a single article? Nanopayments remove the floor. Using Circle's Arc network and EIP-3009 off-chain signatures, we can settle value as small as $0.000001 instantly and gaslessly. This enables creators to sell individual articles, songs, or photos directly to users, opening up a new long-tail economy that subscriptions priced out.",
    price: "0.02",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" // Hardhat #0 address as mockup
  },
  {
    id: "2",
    title: "AI-Agent Economies: How Bots Earn and Spend on the Arc Blockchain",
    author: "Bob Vances",
    snippet: "AI agents are no longer just tools; they are economic actors. By equipping LLMs with programmable wallets, they can autonomously pay...",
    content: "AI agents are no longer just tools; they are economic actors. By equipping LLMs with programmable wallets, they can autonomously pay for APIs, compute, and premium data feeds per request. On the Arc network, an agent can pay $0.001 to summarize a paragraph or $0.01 to generate an image. This eliminates subscription overhead, allowing agents to route request queries to the cheapest, fastest providers dynamically on a strict daily budget.",
    price: "0.05",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  },
  {
    id: "3",
    title: "Decentralized GPU Markets: Renting Compute by the Millisecond",
    author: "Charlie Hacker",
    snippet: "Renting GPUs usually requires high deposit minimums. Continuous payment streams on Arc allow renting GPU compute by the second...",
    content: "Renting GPUs usually requires high deposit minimums. Continuous payment streams on Arc allow renting GPU compute by the second. A user opens a payment channel that streams $0.0001 USDC per second to the provider. The moment the computation finishes, the connection terminates, the payment stops, and the user is only billed for the exact seconds of server runtime used. This maximizes utility for fine-tuning models and batch processing.",
    price: "0.03",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  }
];

let provider = null;
let signer = null;
let userAddress = null;
let currentChainId = null;
let selectedArticle = null;

// DOM Elements
const btnConnect = document.getElementById("btn-connect");
const walletInfo = document.getElementById("wallet-info");
const walletAddressText = document.getElementById("wallet-address");
const articleListEl = document.getElementById("article-list");

const viewerDefault = document.getElementById("viewer-default");
const viewerActive = document.getElementById("viewer-active");
const activeTitle = document.getElementById("active-title");
const activeAuthor = document.getElementById("active-author");
const activePriceTag = document.getElementById("active-price-tag");
const articleContentFree = document.getElementById("article-content-free");
const paywallModule = document.getElementById("paywall-module");
const btnUnlock = document.getElementById("btn-unlock");
const txStatusBox = document.getElementById("tx-status-box");
const txStatusText = document.getElementById("tx-status-text");
const txHashLink = document.getElementById("tx-hash-link");
const paywallError = document.getElementById("paywall-error");
const articleContentPremium = document.getElementById("article-content-premium");

// Load unlocked state from localStorage
function getUnlockedArticles() {
  const data = localStorage.getItem("papercut_unlocked_articles");
  try {
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveUnlockedArticle(id) {
  const unlocked = getUnlockedArticles();
  unlocked[id] = true;
  localStorage.setItem("papercut_unlocked_articles", JSON.stringify(unlocked));
}

// Connect Wallet handler
async function connectWallet() {
  paywallError.style.display = "none";
  if (typeof window.ethereum === "undefined") {
    alert("MetaMask (or a compatible Web3 wallet) is required to test on-chain payments!");
    return;
  }

  try {
    // Request accounts
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    userAddress = accounts[0];

    // Setup Ethers Browser Provider
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    
    const network = await provider.getNetwork();
    currentChainId = network.chainId;

    // Update UI
    btnConnect.style.display = "none";
    walletInfo.style.display = "flex";
    walletAddressText.textContent = shortenAddress(userAddress);
    console.log("[PaperCut Web3] Wallet connected:", userAddress, "on ChainID:", currentChainId);

    // Re-verify the current selected article (e.g. if paywall was showing connection warning)
    if (selectedArticle) {
      selectArticle(selectedArticle.id);
    }
  } catch (error) {
    console.error("Wallet connection failed:", error);
    showPaywallError("Failed to connect wallet.");
  }
}

function shortenAddress(addr) {
  return addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
}

// Render the feed list in HTML (SECURITY FIX: use safe DOM APIs instead of innerHTML)
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderFeed() {
  articleListEl.innerHTML = articles
    .map(
      (art) => `
      <div class="article-card" id="card-${escapeHtml(art.id)}" onclick="selectArticle('${escapeHtml(art.id)}')">
        <div class="card-title">${escapeHtml(art.title)}</div>
        <div class="card-meta">
          <span>By ${escapeHtml(art.author)}</span>
          <span class="price-tag">$${escapeHtml(art.price)}</span>
        </div>
        <div class="card-snippet">${escapeHtml(art.snippet)}</div>
      </div>
    `
    )
    .join("");
}

// Select and open an article
function selectArticle(id) {
  document.querySelectorAll(".article-card").forEach((card) => card.classList.remove("active"));
  const cardEl = document.getElementById(`card-${id}`);
  if (cardEl) cardEl.classList.add("active");

  selectedArticle = articles.find((a) => a.id === id);

  viewerDefault.style.display = "none";
  viewerActive.style.display = "block";
  articleContentFree.style.display = "block";
  paywallModule.style.display = "none";
  txStatusBox.style.display = "none";
  paywallError.style.display = "none";
  articleContentPremium.style.display = "none";

  activeTitle.textContent = selectedArticle.title;
  activeAuthor.textContent = selectedArticle.author;
  activePriceTag.textContent = `$${selectedArticle.price} USDC Equiv`;

  // Check if article is already unlocked locally
  const unlocked = getUnlockedArticles();
  if (unlocked[id]) {
    articleContentFree.textContent = selectedArticle.content;
  } else {
    articleContentFree.textContent = selectedArticle.snippet;
    paywallModule.style.display = "block";

    // Setup click listener for unlock
    btnUnlock.onclick = () => handleOnChainPayment(id);
  }
}

// Trigger Live On-chain Micropayment
async function handleOnChainPayment(articleId) {
  paywallError.style.display = "none";
  txStatusBox.style.display = "none";

  if (!signer) {
    // Attempt auto-connect
    await connectWallet();
    if (!signer) return;
  }

  btnUnlock.style.display = "none";
  txStatusBox.style.display = "flex";
  txStatusText.textContent = "Please confirm the micro-transaction in MetaMask...";
  txHashLink.innerHTML = "";

  try {
    // Send a tiny amount of testnet gas token matching the article's displayed price
    const articleData = articles.find(a => a.id === articleId);
    const priceInEth = articleData ? articleData.price : "0.0001";
    const tx = await signer.sendTransaction({
      to: selectedArticle.payee,
      value: ethers.parseEther(priceInEth.toString())
    });

    console.log("[PaperCut Web3] Transaction sent. Hash:", tx.hash);
    txStatusText.textContent = "Transaction broadcasting. Waiting for on-chain block confirmation...";
    
    // Generate Block Explorer Link (SECURITY FIX: use safe DOM APIs)
    const explorerUrl = getExplorerUrl(currentChainId, tx.hash);
    txHashLink.innerHTML = '';
    const explorerLink = document.createElement('a');
    explorerLink.href = explorerUrl;
    explorerLink.target = '_blank';
    explorerLink.rel = 'noopener noreferrer';
    explorerLink.textContent = 'View on Block Explorer ↗';
    txHashLink.appendChild(explorerLink);

    // Wait for 1 block confirmation
    const receipt = await tx.wait();
    console.log("[PaperCut Web3] Transaction confirmed in block:", receipt.blockNumber);

    // Unlock article
    saveUnlockedArticle(articleId);
    
    txStatusText.textContent = "Success! Payment confirmed. Loading article...";
    setTimeout(() => {
      paywallModule.style.display = "none";
      articleContentFree.style.display = "none";
      articleContentPremium.textContent = selectedArticle.content;
      articleContentPremium.style.display = "block";
      btnUnlock.style.display = "inline-block";
    }, 1500);

  } catch (error) {
    console.error("On-chain transaction failed:", error);
    btnUnlock.style.display = "inline-block";
    txStatusBox.style.display = "none";
    
    if (error.code === "ACTION_REJECTED") {
      showPaywallError("User rejected the transaction in MetaMask.");
    } else {
      showPaywallError("Transaction failed. Make sure you have Testnet Gas Token.");
    }
  }
}

// Get correct explorer link based on MetaMask chain ID
function getExplorerUrl(chainId, txHash) {
  // Convert chainId to Number if it is BigInt
  const id = Number(chainId);
  switch (id) {
    case 11155111: // Sepolia
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    case 84532: // Base Sepolia
      return `https://sepolia.basescan.org/tx/${txHash}`;
    case 421614: // Arbitrum Sepolia
      return `https://sepolia.arbiscan.io/tx/${txHash}`;
    case 54321: // Arc Testnet
      return `https://explorer.arc.network/tx/${txHash}`;
    default: return `https://etherscan.io/tx/${txHash}`; // Fallback — may not match actual network
  }
}

function showPaywallError(msg) {
  paywallError.textContent = msg;
  paywallError.style.display = "block";
}

// Listen for MetaMask account/network changes
if (typeof window.ethereum !== "undefined") {
  window.ethereum.on("accountsChanged", (accounts) => {
    if (accounts.length === 0) {
      // Wallet disconnected
      btnConnect.style.display = "inline-block";
      walletInfo.style.display = "none";
      signer = null;
      userAddress = null;
    } else {
      userAddress = accounts[0];
      walletAddressText.textContent = shortenAddress(userAddress);
      connectWallet();
    }
  });

  window.ethereum.on("chainChanged", () => {
    // Reload the page to refresh providers
    window.location.reload();
  });
}

btnConnect.addEventListener("click", connectWallet);

// Initial setup
renderFeed();
