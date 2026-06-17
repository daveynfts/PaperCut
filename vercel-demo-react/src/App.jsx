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

const UsdcCoinIcon = ({ size = 24, className = "", style = {} }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={`usdc-3d-coin ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <defs>
        {/* Shadow for the entire coin to give it depth */}
        <filter id="coin-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1.5" dy="3" stdDeviation="2" floodColor="#0d284a" floodOpacity="0.4" />
        </filter>
        
        {/* Outer 3D side edge gradient (darker blue metal) */}
        <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#226cb8" />
          <stop offset="50%" stopColor="#154980" />
          <stop offset="100%" stopColor="#0c2d52" />
        </linearGradient>

        {/* Outer rim front face gradient (medium-light USDC blue) */}
        <linearGradient id="rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5fa1eb" />
          <stop offset="40%" stopColor="#2775CA" />
          <stop offset="100%" stopColor="#18569c" />
        </linearGradient>

        {/* Inner recessed face gradient - reverse lighting to simulate depth */}
        <linearGradient id="face-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#154980" />
          <stop offset="50%" stopColor="#2775CA" />
          <stop offset="100%" stopColor="#5fa1eb" />
        </linearGradient>

        {/* Raised symbol ice white gradient */}
        <linearGradient id="symbol-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#f0f5fd" />
          <stop offset="100%" stopColor="#d5e4f7" />
        </linearGradient>

        {/* Emboss shadow filters for the USDC symbol */}
        <filter id="emboss-filter">
          <feDropShadow dx="-0.4" dy="-0.4" stdDeviation="0.2" floodColor="#ffffff" floodOpacity="0.9" />
          <feDropShadow dx="0.6" dy="0.6" stdDeviation="0.4" floodColor="#0c2d52" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* 3D Side/Edge (Extruded cylinder part) */}
      <path 
        d="M 70.87 17.13 A 38 38 0 0 1 17.13 70.87 L 25.13 78.87 A 38 38 0 0 0 78.87 25.13 Z" 
        fill="url(#edge-grad)" 
        stroke="#0c2d52" 
        strokeWidth="1.5" 
        strokeLinejoin="round"
      />

      {/* Main Front Face Rim (Top Circle) */}
      <circle cx="44" cy="44" r="38" fill="url(#rim-grad)" stroke="#0c2d52" strokeWidth="1.5" />
      
      {/* Inner Rim ridge ring */}
      <circle cx="44" cy="44" r="34" fill="none" stroke="#0c2d52" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6" />
      
      {/* Recessed Coin Face */}
      <circle cx="44" cy="44" r="30" fill="url(#face-grad)" stroke="#0c2d52" strokeWidth="1.2" />

      {/* USDC ($) Symbol Group centered at (44,44) */}
      <g transform="translate(44, 44) scale(2.4) translate(-12, -12)" filter="url(#emboss-filter)">
        {/* S-shape backdrop outline */}
        <path d="M12 6V18M12 6C9.5 6 9.5 9 12 9C14.5 9 14.5 12 12 12C9.5 12 9.5 15 12 15C14.5 15 14.5 18 12 18" stroke="#0c2d52" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9.5 9.5C9.5 7.5 10.5 6 12 6C13.5 6 14.5 7.5 14.5 9.5M9.5 14.5C9.5 16.5 10.5 18 12 18C13.5 18 14.5 16.5 14.5 14.5" stroke="#0c2d52" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>

        {/* Foreground Symbol stroke */}
        <path d="M12 6V18M12 6C9.5 6 9.5 9 12 9C14.5 9 14.5 12 12 12C9.5 12 9.5 15 12 15C14.5 15 14.5 18 12 18" stroke="url(#symbol-grad)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9.5 9.5C9.5 7.5 10.5 6 12 6C13.5 6 14.5 7.5 14.5 9.5M9.5 14.5C9.5 16.5 10.5 18 12 18C13.5 18 14.5 16.5 14.5 14.5" stroke="url(#symbol-grad)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  );
};

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

  // Scraper Simulation States
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStep, setScrapeStep] = useState(0); // 0=idle, 1=query, 2=payment, 3=downloading, 4=done
  const [scrapeWords, setScrapeWords] = useState(0);
  const [scrapeCost, setScrapeCost] = useState(0);
  const [scrapeResult, setScrapeResult] = useState("");

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
    // Reset scraper simulation
    setIsScraping(false);
    setScrapeStep(0);
    setScrapeWords(0);
    setScrapeCost(0);
    setScrapeResult("");
  };

  const triggerScrapeSimulation = () => {
    if (isScraping) return;
    setIsScraping(true);
    setScrapeStep(1); // query
    setScrapeWords(0);
    setScrapeCost(0);
    setScrapeResult("");

    const costPerRead = parseFloat(selectedArticle?.price || "0.0001");

    // Step 1: Query article info (2s)
    setTimeout(() => {
      setScrapeStep(2); // payment processing
      
      // Step 2: Pay on-chain micropayment tariff (3s)
      setTimeout(() => {
        setScrapeStep(3); // scraping / word count counting up
        
        // Simulating the word count scraper (4s)
        let count = 0;
        const totalWords = 84; // Mock word length of the premium column
        const interval = setInterval(() => {
          count += 7;
          if (count >= totalWords) {
            clearInterval(interval);
            setScrapeWords(totalWords);
            setScrapeCost(costPerRead);
            
            // Step 4: Finished scraping, displaying the synthesized analysis summary (1.5s)
            setTimeout(() => {
              setScrapeStep(4); // done
              setScrapeResult(
                `[AI ANALYTICAL REPORT] "${selectedArticle?.title || "Dispatch"}" reveals a revolutionary shift from traditional subscription-bundled payment models to programmatic API-driven micropayment channels. Equipped with Circle MPC Wallets, autonomous LLM agents buy web infrastructure, GPU computing, and premium information directly. Settle total of ${costPerRead} USDC was successfully processed on-chain.`
              );
            }, 1000);
          } else {
            setScrapeWords(count);
            // Increment cost proportionally to cawed words
            setScrapeCost((count / totalWords) * costPerRead);
          }
        }, 300);

      }, 3000);

    }, 2000);
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
                  <span className="price-tag">
                    <UsdcCoinIcon size={12} className="coin-sidebar" style={{ marginRight: '3px', marginTop: '-2px' }} />
                    {art.price}
                  </span>
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
                  <span className="price-badge">TARIFF: <UsdcCoinIcon size={14} className="coin-inline" style={{ marginRight: '4px', marginTop: '-3px' }} /> {selectedArticle.price} USDC Coinage</span>
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
                              {!authenticated ? "SIGN REGISTER" : (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  PAY {selectedArticle.price} <UsdcCoinIcon size={14} className="coin-inline" /> USDC
                                </span>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Divider Line */}
                        <div className="paywall-option-divider"></div>

                        {/* Option 2: AI Agent */}
                        <div className="paywall-option-box">
                          <div className="option-icon">🤖</div>
                          <div className="option-title">AI SCRAPER AGENT</div>
                          
                          {!isScraping ? (
                            <>
                              <p className="paywall-desc">
                                Trigger simulated robot scraping sequence & micro-payments.
                              </p>
                              <button 
                                className="btn btn-sm btn-paywall btn-secondary"
                                onClick={triggerScrapeSimulation}
                              >
                                LAUNCH AGENT
                              </button>
                            </>
                          ) : (
                            /* Live Terminal Mockup Simulator Screen */
                            <div className="scraper-terminal">
                              <div className="terminal-header">
                                <span className="term-dot red"></span>
                                <span className="term-dot yellow"></span>
                                <span className="term-dot green"></span>
                                <span className="term-title">AI-Agent Terminal @ ScraperPort</span>
                              </div>
                              <div className="terminal-body mono-text">
                                {scrapeStep >= 1 && (
                                  <div className="term-line prompt">
                                    <span className="term-accent">&gt;</span> query --prompt "{selectedArticle.title}"
                                  </div>
                                )}
                                {scrapeStep === 1 && (
                                  <div className="term-line loading">
                                    Scanning database for target dispatches...
                                  </div>
                                )}
                                {scrapeStep >= 2 && (
                                  <>
                                    <div className="term-line success">
                                      Dispatch found. ID: {selectedArticle.id}. Size: 84 words.
                                    </div>
                                    <div className="term-line prompt">
                                      <span className="term-accent">&gt;</span> settle-tariff --amount {selectedArticle.price} --network arc-testnet
                                    </div>
                                  </>
                                )}
                                {scrapeStep === 2 && (
                                  <div className="term-line loading">
                                    Executing Circle MPC wallet gasless transfer...
                                  </div>
                                )}
                                {scrapeStep >= 3 && (
                                  <>
                                    <div className="term-line success">
                                      Tx settled. Hash: 0x8fd...35e0.
                                    </div>
                                    <div className="term-line prompt">
                                      <span className="term-accent">&gt;</span> scrape --target content --stream-read
                                    </div>
                                    <div className="term-line info highlight-box">
                                      <span>[STREAMING DATA]</span><br/>
                                      <span>Words Read: <strong>{scrapeWords} / 84</strong></span><br/>
                                      <span>Current Cost: <strong>{scrapeCost.toFixed(6)}</strong> <UsdcCoinIcon size={12} className="coin-inline" style={{ margin: '0 2px 0 4px', marginTop: '-2px' }} /> USDC</span>
                                    </div>
                                  </>
                                )}
                                {scrapeStep === 3 && (
                                  <div className="term-line loading">
                                    Cawing premium column paragraphs...
                                  </div>
                                )}
                                {scrapeStep >= 4 && (
                                  <>
                                    <div className="term-line success" style={{ color: '#5cd15c', fontWeight: 'bold' }}>
                                      Scraping complete. Settle total: {scrapeCost.toFixed(4)} <UsdcCoinIcon size={12} className="coin-inline" style={{ margin: '0 2px 0 4px', marginTop: '-2px' }} /> USDC.
                                    </div>
                                    <div className="term-line prompt">
                                      <span className="term-accent">&gt;</span> summarize-report --llm-refine
                                    </div>
                                    <div className="term-report-box">
                                      {scrapeResult}
                                    </div>
                                    <button 
                                      className="btn btn-sm" 
                                      style={{ marginTop: '8px', fontSize: '9px', padding: '2px 8px', float: 'right' }}
                                      onClick={() => {
                                        setIsScraping(false);
                                        setScrapeStep(0);
                                        setScrapeWords(0);
                                        setScrapeCost(0);
                                        setScrapeResult("");
                                      }}
                                    >
                                      RESET BOT
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
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
                  <div className="wallet-balance-row" style={{ display: 'flex', alignItems: 'center' }}>
                    <UsdcCoinIcon size={24} className="coin-balance-icon" style={{ marginRight: '6px' }} />
                    <span className="balance-num">{parseFloat(circleWallet?.balance || "0.0000").toFixed(4)}</span>
                    <span className="balance-denom">USDC</span>
                    <button 
                      onClick={handleSyncBalance} 
                      className="btn-sync-balance-vintage"
                      title="Sync Balance with Ledger"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                        <path d="M23 4v6h-6" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
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
