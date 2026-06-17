import React, { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import './App.css';

const articles = [
  {
    id: "1",
    title: "The Rebirth of the Lepton: Why Nanopayments are the Future of Web3",
    author: "Alice Sterling",
    snippet: "For decades, subscription models have forced users to pay for bundled content. But what if you could pay $0.02 to read a single article...",
    content: "For decades, subscription models have forced users to pay for bundled content. But what if you could pay $0.02 to read a single article? Nanopayments remove the floor. Using Circle's Arc network and EIP-3009 off-chain signatures, we can settle value as small as $0.000001 instantly and gaslessly. This enables creators to sell individual articles, songs, or photos directly to users, opening up a new long-tail economy that subscriptions priced out.",
    price: "0.02",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
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

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function App() {
  const { login, logout, authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  const [selectedArticle, setSelectedArticle] = useState(null);
  const [unlockedArticles, setUnlockedArticles] = useState({});
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [chainId, setChainId] = useState(null);

  const [circleWallet, setCircleWallet] = useState(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState("Click address to copy");
  const [faucetLoading, setFaucetLoading] = useState(false);

  const handleCopyAddress = (addr) => {
    if (!addr) return;
    navigator.clipboard.writeText(addr).then(() => {
      setCopyStatus("Copied Address!");
      setTimeout(() => setCopyStatus("Click address to copy"), 1500);
    });
  };

  const handleSyncBalance = async () => {
    if (!authenticated || !user || !circleWallet) return;
    setCopyStatus("Syncing balance...");
    try {
      const userEmail = user.email?.address || user.id || "anonymous-user";
      const response = await fetch(`${BACKEND_URL}/api/user/wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          email: userEmail,
          walletId: circleWallet.walletId,
          address: circleWallet.address
        })
      });
      const data = await response.json();
      if (response.ok) {
        setCircleWallet(prev => prev ? { ...prev, balance: data.balance } : null);
        setCopyStatus("Balance updated!");
        setTimeout(() => setCopyStatus("Click address to copy"), 1500);
      } else {
        setCopyStatus("Sync failed.");
        setTimeout(() => setCopyStatus("Click address to copy"), 1500);
      }
    } catch (err) {
      console.error(err);
      setCopyStatus("Sync failed.");
      setTimeout(() => setCopyStatus("Click address to copy"), 1500);
    }
  };

  const handleRequestFaucet = async () => {
    if (!authenticated || !user || !circleWallet) return;
    setFaucetLoading(true);
    setCopyStatus("Requesting faucet...");
    try {
      const userEmail = user.email?.address || user.id || "anonymous-user";
      const response = await fetch(`${BACKEND_URL}/api/user/faucet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: userEmail })
      });
      const data = await response.json();
      if (response.ok) {
        setCircleWallet(prev => prev ? { ...prev, balance: data.balance } : null);
        setCopyStatus("Faucet complete (+0.05 USDC)!");
        setTimeout(() => setCopyStatus("Click address to copy"), 2000);
      } else {
        setCopyStatus(data.error || "Faucet failed.");
        setTimeout(() => setCopyStatus("Click address to copy"), 5000);
      }
    } catch (err) {
      console.error(err);
      setCopyStatus("Faucet offline.");
      setTimeout(() => setCopyStatus("Click address to copy"), 5000);
    } finally {
      setFaucetLoading(false);
    }
  };

  // Load unlocked states from storage on mount
  useEffect(() => {
    const data = localStorage.getItem("papercut_unlocked_articles");
    if (data) {
      setUnlockedArticles(JSON.parse(data));
    }
  }, []);

  // Update active wallet chain ID when wallet changes
  useEffect(() => {
    if (wallets && wallets[0]) {
      setChainId(wallets[0].chainId);
    }
  }, [wallets]);

  // Fetch or create user's Circle Programmable Wallet on backend upon login
  useEffect(() => {
    const fetchUserCircleWallet = async () => {
      if (!authenticated || !user) {
        setCircleWallet(null);
        return;
      }
      
      setIsLoadingWallet(true);
      setError("");
      
      const userEmail = user.email?.address || user.id || "anonymous-user";
      
      // Load local wallet backup if available to recover mapping on serverless cold starts
      let localBackup = null;
      try {
        const stored = localStorage.getItem(`circle_wallet_${userEmail}`);
        if (stored) {
          localBackup = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to read local wallet backup:", e);
      }
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/user/wallet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ 
            email: userEmail,
            walletId: localBackup?.walletId,
            address: localBackup?.address
          })
        });
        const data = await response.json();
        if (response.ok) {
          const walletData = {
            address: data.address,
            balance: data.balance,
            walletId: data.walletId
          };
          setCircleWallet(walletData);
          localStorage.setItem(`circle_wallet_${userEmail}`, JSON.stringify(walletData));
        } else {
          setError(data.error || "Failed to load Circle MPC wallet.");
        }
      } catch (err) {
        console.error("Error fetching Circle wallet:", err);
        setError("Backend server connection failed. Make sure port 4000 is running.");
      } finally {
        setIsLoadingWallet(false);
      }
    };
    
    fetchUserCircleWallet();
  }, [authenticated, user]);

  const activeWallet = wallets ? wallets[0] : null;
  const smartWalletAddress = circleWallet?.address;

  const shortenAddress = (addr) => {
    if (!addr) return "";
    return addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
  };

  const handleSelectArticle = (art) => {
    setSelectedArticle(art);
    setTxStatus("");
    setTxHash("");
    setError("");
  };

  const handleUnlockOnChain = async () => {
    setError("");
    setTxStatus("");
    setTxHash("");

    if (!authenticated) {
      login();
      return;
    }

    if (!circleWallet) {
      setError("Circle wallet is not ready. Please try logging in again.");
      return;
    }

    setTxStatus("Authorizing pay-per-read micropayment via Circle W3S...");

    const userEmail = user?.email?.address || user?.id || "anonymous-user";

    try {
      const response = await fetch(`${BACKEND_URL}/api/articles/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: userEmail,
          articleId: selectedArticle.id
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Micropayment failed.");
      }

      console.log("[PaperCut React] Micropayment transfer successful:", data.txHash);
      setTxHash(data.txHash);
      setTxStatus("Payment settled on Arc Testnet!");

      // Update local wallet balance state
      setCircleWallet(prev => prev ? { ...prev, balance: data.balance } : null);

      // Save unlocked state
      const updatedUnlocked = { ...unlockedArticles, [selectedArticle.id]: true };
      setUnlockedArticles(updatedUnlocked);
      localStorage.setItem("papercut_unlocked_articles", JSON.stringify(updatedUnlocked));
      
      setTimeout(() => {
        setTxStatus("");
        setTxHash("");
      }, 2000);

    } catch (err) {
      console.error("Micropayment error:", err);
      setTxStatus("");
      setError(err.message || "Transaction failed. Do you have enough USDC balance?");
    }
  };

  const getExplorerUrl = (id, hash) => {
    const numericId = Number(id?.replace("eip155:", "") || "1");
    switch (numericId) {
      case 11155111:
        return `https://sepolia.etherscan.io/tx/${hash}`;
      case 84532:
        return `https://sepolia.basescan.org/tx/${hash}`;
      case 421614:
        return `https://sepolia.arbiscan.io/tx/${hash}`;
      case 5042002:
        return `https://testnet.arcscan.app/tx/${hash}`;
      default:
        return `https://etherscan.io/tx/${hash}`;
    }
  };

  return (
    <div className="app-root">
      {/* NAV BAR */}
      <nav className="nav">
        <div className="nav-brand">
          <span className="logo-symbol">Λ</span>
          <span className="logo-text">The PaperCut Ledger</span>
        </div>
        <div className="nav-controls">
          {!authenticated ? (
            <button className="btn btn-sm" onClick={login}>Sign Register</button>
          ) : (
            <div className="wallet-info-group">
              <button 
                className="btn-wallet-icon" 
                onClick={() => setShowWalletModal(true)} 
                title={`Open Ledger Vault Wallet (${smartWalletAddress || activeWallet?.address || user?.wallet?.address})`}
              >
                <svg width="18" height="16" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                  <path d="M17 4H3C1.89543 4 1 4.89543 1 6V15C1 16.1046 1.89543 17 3 17H17C18.1046 17 19 16.1046 19 15V6C19 4.89543 18.1046 4 17 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M19 8H14.5C13.6716 8 13 8.67157 13 9.5C13 10.3284 13.6716 11 14.5 11H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1 8.5C1 4.5 4.5 1 9.5 1H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button className="btn btn-sm btn-secondary" onClick={logout} style={{ marginLeft: '12px' }}>Sign Out</button>
            </div>
          )}
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main className="main-container">
        {/* LEFT SIDEBAR */}
        <section className="sidebar">
          <div className="section-title">
            <h2>LATEST DISPATCHES</h2>
            <span className="item-count">{articles.length} columns published</span>
          </div>
          <div className="article-list">
            {articles.map((art) => (
              <div
                key={art.id}
                className={`article-card ${selectedArticle?.id === art.id ? 'active' : ''}`}
                onClick={() => handleSelectArticle(art)}
              >
                <div className="card-title">{art.title}</div>
                <div className="card-meta">
                  <span>By {art.author}</span>
                  <span className="price-tag">${art.price}</span>
                </div>
                <div className="card-snippet">{art.snippet}</div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT CONTENT */}
        <section className="viewer">
          {!selectedArticle ? (
            <div id="viewer-default" className="viewer-state">
              <div className="greek-key"></div>
              <h1 className="serif-title font-italic">Select a Dispatch to Peruse</h1>
              <p className="mono-text text-muted">Demonstrating a Modern Electronic Ledger & Gasless Micro-Tariff System.</p>
              <div className="badge-row">
                <span className="chain-badge">Sign Register</span>
                <span className="chain-badge">Secured Ledger Vault</span>
                <span className="chain-badge">Arc Testnet</span>
              </div>
            </div>
          ) : (
            <div id="viewer-active" className="viewer-state">
              <div className="article-header">
                <h1 className="serif-title">{selectedArticle.title}</h1>
                <div className="article-meta">
                  <span>By <strong style={{ color: 'var(--white)' }}>{selectedArticle.author}</strong></span>
                  <span className="divider">•</span>
                  <span className="price-badge">TARIFF: {selectedArticle.price} USDC Coinage</span>
                </div>
              </div>

              <div className="greek-key tight"></div>

              <div className="article-body">
                {unlockedArticles[selectedArticle.id] ? (
                  <div className="content-text premium-unlocked">
                    {selectedArticle.content}
                  </div>
                ) : (
                  <>
                    <div className="content-text">
                      {selectedArticle.snippet}
                    </div>

                    {/* PAYWALL */}
                    <div className="paywall-card">
                      <div className="paywall-title">TOLL BARRIER: TARIFF DUE</div>
                      
                      <div className="paywall-options-container">
                        {/* Option 1: Human Reader */}
                        <div className="paywall-option-box">
                          <div className="option-icon">🖋️</div>
                          <div className="option-title">HUMAN READER</div>
                          <p className="paywall-desc">
                            {!authenticated 
                              ? "Sign the register to create a Ledger Vault." 
                              : `Vault: ${shortenAddress(circleWallet?.address)} | Bal: ${parseFloat(circleWallet?.balance || '0.00').toFixed(4)} USDC`
                            }
                          </p>
                          {!txStatus && (
                            <button className="btn btn-sm btn-paywall" onClick={handleUnlockOnChain}>
                              {!authenticated ? "SIGN REGISTER" : "PAY 0.0001 USDC"}
                            </button>
                          )}
                        </div>

                        {/* Divider Line */}
                        <div className="paywall-option-divider"></div>

                        {/* Option 2: AI Agent */}
                        <div className="paywall-option-box">
                          <div className="option-icon">🤖</div>
                          <div className="option-title">AI SCRAPER AGENT</div>
                          <p className="paywall-desc">
                            Autonomously retrieve clean text via program terminal.
                          </p>
                          <button 
                            className="btn btn-sm btn-paywall btn-secondary"
                            onClick={() => alert(`To access programmatically as an AI Agent, run this cURL request:\n\ncurl -X POST "${BACKEND_URL}/api/articles/unlock" \\\n  -H "Content-Type: application/json" \\\n  -d '{"email": "${user?.email?.address || "your-registered-email"}", "articleId": "${selectedArticle.id}"}'`)}
                          >
                            GET API CMD
                          </button>
                        </div>
                      </div>

                      {txStatus && (
                        <div className="tx-status-box" style={{ marginTop: '20px', width: '100%' }}>
                          <span className="spinner"></span>
                          <span>{txStatus}</span>
                          {txHash && (
                            <div className="tx-hash-link">
                              <a href={getExplorerUrl(chainId, txHash)} target="_blank" rel="noopener noreferrer">
                                Verify Ledger Record ↗
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {error && <div className="paywall-error" style={{ marginTop: '15px', width: '100%' }}>{error}</div>}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* WALLET DEPOSIT & QR MODAL */}
      {showWalletModal && (
        <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
          <div className="modal-content vintage-wallet-modal" onClick={(e) => e.stopPropagation()}>
            {/* Vintage Close Button in the upper right corner */}
            <button className="wallet-close-btn" onClick={() => setShowWalletModal(false)}>×</button>
            
            <div className="vintage-wallet-container">
              {/* LEFT COLUMN: IDs & INFO */}
              <div className="wallet-pane-left">
                <div className="wallet-header">
                  <div className="wallet-seal">★ OFFICIAL IDENTITY CARD ★</div>
                  <h3 className="wallet-title">THE PAPERCUT LEDGER</h3>
                  <div className="wallet-subtitle">TARIFF ACCOUNT & PORTFOLIO</div>
                </div>
                
                <div className="wallet-divider-double"></div>
                
                <div className="wallet-id-group">
                  <div className="wallet-id-label">HOLDER IDENTITY (EMAIL)</div>
                  <div className="wallet-id-value mono-text">
                    {user?.email?.address || user?.id || "ANONYMOUS READER"}
                  </div>
                </div>

                <div className="wallet-id-group">
                  <div className="wallet-id-label">ACCOUNT NO. (CIRCLE ADDRESS)</div>
                  <div 
                    className="wallet-address-box mono-text" 
                    onClick={() => handleCopyAddress(smartWalletAddress || activeWallet?.address || user?.wallet?.address)}
                    title="Click to copy address"
                  >
                    <span className="address-text">
                      {smartWalletAddress || activeWallet?.address || user?.wallet?.address}
                    </span>
                    <span className="copy-badge">{copyStatus}</span>
                  </div>
                </div>

                <div className="wallet-id-group">
                  <div className="wallet-id-label">CURRENT BALANCE</div>
                  <div className="wallet-balance-row">
                    <span className="balance-num">{parseFloat(circleWallet?.balance || "0.0000").toFixed(4)}</span>
                    <span className="balance-denom">USDC</span>
                    <button 
                      onClick={handleSyncBalance} 
                      className="btn-sync-balance-vintage"
                      title="Sync Balance with Ledger"
                    >
                      🔄
                    </button>
                  </div>
                </div>

                <div className="wallet-id-group-row">
                  <div className="wallet-id-group half">
                    <div className="wallet-id-label">ISSUING BLOCKCHAIN</div>
                    <div className="wallet-id-value mono-text text-accent">ARC TESTNET</div>
                  </div>
                  <div className="wallet-id-group half">
                    <div className="wallet-id-label">GAS FEE SPONSOR</div>
                    <div className="wallet-id-value mono-text text-stamp">PUBLISHER PAID</div>
                  </div>
                </div>

                <div className="wallet-actions-section">
                  <button 
                    className="btn-faucet-stamp" 
                    onClick={handleRequestFaucet} 
                    disabled={faucetLoading}
                  >
                    {faucetLoading ? "STAMPING TARIFF..." : "CLAIM 0.05 USDC FAUCET"}
                  </button>
                </div>
              </div>
              
              {/* MIDDLE FOLD SPINE */}
              <div className="wallet-pane-spine">
                <div className="spine-stitch"></div>
              </div>

              {/* RIGHT COLUMN: QR CODE STAMP */}
              <div className="wallet-pane-right">
                <div className="qr-stamp-frame">
                  <div className="qr-stamp-header">PORTRAIT / ACCREDITATION</div>
                  <div className="qr-code-wrapper">
                    <img 
                      className="qr-code-img-vintage" 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${smartWalletAddress || activeWallet?.address || user?.wallet?.address}`} 
                      alt="Wallet QR Code" 
                    />
                  </div>
                  <div className="qr-stamp-footer">SCAN TO DEPOSIT FUNDS</div>
                </div>

                <div className="wallet-stamp-seal">
                  <div className="stamp-seal-circle">
                    <span>PAID</span>
                    <span className="stamp-date">1926</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
