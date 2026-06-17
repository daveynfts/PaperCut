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
            <button className="btn btn-sm" onClick={login}>Login (Gmail/Wallet)</button>
          ) : (
            <div className="wallet-info-group">
              <div className="wallet-info" onClick={() => setShowWalletModal(true)} style={{ cursor: 'pointer' }} title="Click to view wallet & QR code">
                <span className="status-dot"></span>
                <span>
                  {smartWalletAddress 
                    ? `Circle MPC: ${shortenAddress(smartWalletAddress)}` 
                    : shortenAddress(activeWallet?.address || user?.wallet?.address)
                  }
                </span>
              </div>
              {smartWalletAddress && (
                <span className="badge-sponsored" style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(230, 184, 76, 0.2)', color: '#e6b84c', border: '1px solid #e6b84c' }}>
                  Circle Gasless
                </span>
              )}
              <button className="btn btn-sm btn-secondary" onClick={logout} style={{ marginLeft: '8px' }}>Logout</button>
            </div>
          )}
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main className="main-container">
        {/* LEFT SIDEBAR */}
        <section className="sidebar">
          <div className="section-title">
            <h2>PREMIUM ARTICLES</h2>
            <span className="item-count">{articles.length} articles</span>
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
              <h1 className="serif-title font-italic">Select an article</h1>
              <p className="mono-text text-muted">Web3 Social Login + Micropayments live demo.</p>
              <div className="badge-row">
                <span className="chain-badge">Login with Google</span>
                <span className="chain-badge">Embedded Wallet</span>
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
                  <span className="price-badge">${selectedArticle.price} USDC Equiv</span>
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
                      <div className="paywall-title">Web3 Paywall Required</div>
                      <p className="paywall-desc">
                        {!authenticated 
                          ? "Log in with your Google account to automatically create an embedded Web3 wallet and read."
                          : `Your Circle MPC Wallet: ${circleWallet?.address || 'Loading...'} | Balance: ${circleWallet?.balance || '0.0000'} USDC. Unlock this article on-chain by sending a micro-transaction of 0.0001 USDC (Gas sponsored by publisher).`
                        }
                      </p>
                      
                      {!txStatus && (
                        <button className="btn btn-lg" onClick={handleUnlockOnChain}>
                          {!authenticated ? "Login to Unlock" : "Unlock on-chain"}
                        </button>
                      )}

                      {txStatus && (
                        <div className="tx-status-box">
                          <span className="spinner"></span>
                          <span>{txStatus}</span>
                          {txHash && (
                            <div className="tx-hash-link">
                              <a href={getExplorerUrl(chainId, txHash)} target="_blank" rel="noopener noreferrer">
                                View on Block Explorer ↗
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {error && <div className="paywall-error">{error}</div>}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Your Circle MPC Wallet</h3>
            
            <div className="modal-address-container" onClick={() => handleCopyAddress(smartWalletAddress || activeWallet?.address || user?.wallet?.address)} title="Click to copy address">
              <div style={{ fontSize: '9px', color: 'var(--g600)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                Wallet Address (Click to Copy)
              </div>
              <div style={{ wordBreak: 'break-all', fontSize: '11px', color: 'var(--g100)', padding: '4px', fontFamily: 'monospace' }}>
                {smartWalletAddress || activeWallet?.address || user?.wallet?.address}
              </div>
              <div style={{ fontSize: '8px', color: 'var(--accent)', marginTop: '4px', fontFamily: 'monospace' }}>
                {copyStatus}
              </div>
            </div>

            <div className="modal-balance-label">USDC Balance</div>
            <div className="modal-balance-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span>{parseFloat(circleWallet?.balance || "0.0000").toFixed(4)}</span>
              <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--g200)' }}>USDC</span>
              <button 
                onClick={handleSyncBalance} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--accent)', 
                  cursor: 'pointer', 
                  fontSize: '16px', 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '50%',
                  transition: 'transform 0.2s'
                }} 
                title="Sync Balance"
                className="btn-sync-balance"
              >
                🔄
              </button>
            </div>

            <div className="qr-code-container">
              <img 
                className="qr-code-img" 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${smartWalletAddress || activeWallet?.address || user?.wallet?.address}`} 
                alt="Wallet QR Code" 
              />
            </div>

            <div className="modal-net-info">
              Network: <span style={{ color: 'var(--accent)' }}>Arc Testnet</span>
            </div>

            <button 
              className="btn-modal-close" 
              onClick={handleRequestFaucet} 
              disabled={faucetLoading}
              style={{ 
                width: '100%', 
                marginBottom: '10px', 
                backgroundColor: 'rgba(230, 184, 76, 0.15)', 
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
                textTransform: 'uppercase',
                fontSize: '11px',
                padding: '8px',
                borderRadius: '2px',
                fontFamily: 'monospace'
              }}
            >
              {faucetLoading ? "Processing Faucet..." : "Claim 0.05 USDC Faucet"}
            </button>

            <button className="btn-modal-close" onClick={() => setShowWalletModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
