import React, { useState, useEffect } from 'react';
import { usePrivy, useWallets, useLogin } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import './App.css';
import logoImg from './assets/logo.png';

const articles = [
  {
    id: "0",
    title: "Exploring the Antigravity of Decentralized Liquidity",
    author: "Hayden Adams",
    snippet: "How automated market makers and concentrated liquidity protocols are redefining financial architecture without intermediaries...",
    content: "How automated market makers and concentrated liquidity protocols are redefining financial architecture without intermediaries. Traditional financial plumbing relies on order books managed by centralized institutions. By utilizing constant product formulas and on-chain liquidity pools, Uniswap proved that trustless market-making is not only possible but highly efficient. Concentrated liquidity further refines this by allowing providers to allocate capital to specific price ranges, maximizing efficiency and cementing AMMs as the foundational substrate of decentralized finance.",
    price: "0.05",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  },
  {
    id: "1",
    title: "The Promise and Challenges of Crypto-Pluralism",
    author: "Vitalik Buterin",
    snippet: "Pluralism in the digital age requires decentralized governance models that respect individual sovereignty while fostering coordination...",
    content: "Pluralism in the digital age requires decentralized governance models that respect individual sovereignty while fostering coordination. Quadratic voting, retrofunding, and decentralized identity systems represent the first wave of tools enabling communities to steward public goods without relying on centralized bureaucracies. We must refine these mechanisms to ensure they are robust against collusion, Sybil attacks, and platform capture, cementing a truly democratic substrate for the internet.",
    price: "0.08",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  },
  {
    id: "2",
    title: "The Rise of the Startup Society and Cloud First Cities",
    author: "Balaji Srinivasan",
    snippet: "Physical nations are slow, bureaucratic, and bound to geographical legacy. The startup society starts cloud-first, building digital...",
    content: "Physical nations are slow, bureaucratic, and bound to geographical legacy. The startup society starts cloud-first, building digital consensus, crowdfunding land, and negotiating diplomatic recognition dynamically. By leveraging public block explorers, cryptographic citizenship, and smart-contract law, we can run experiments in governance at cloud speeds, offering alternative jurisdictions for people who value innovation and voluntary association.",
    price: "0.10",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  },
  {
    id: "3",
    title: "Ultra-Sound Money: Analysing the Deflationary Mechanics of EIP-1559",
    author: "Bankless",
    snippet: "Is Ethereum truly ultra-sound? Let's dissect the base fee burn mechanism and how network transaction fee demand impacts ether supply...",
    content: "Is Ethereum truly ultra-sound? Let's dissect the base fee burn mechanism and how network transaction fee demand impacts ether supply. Under EIP-1559, a portion of every transaction fee is permanently removed from circulation. When network activity exceeds threshold limits, the burn rate surpasses issuance, resulting in net-deflationary supply dynamics. This fundamentally transforms ether from a pure utility token into a scarce, productive store of value.",
    price: "0.04",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  },
  {
    id: "4",
    title: "Read, Write, Own: How Web3 Restores the Original Vision of the Internet",
    author: "Chris Dixon",
    snippet: "Web1 was read-only, dominated by open protocols. Web2 added write capabilities, but centralized the power in corporate platforms. Web3...",
    content: "Web1 was read-only, dominated by open protocols. Web2 added write capabilities, but centralized the power in corporate platforms. Web3 introduces ownership. By giving users and builders direct ownership of the networks they use through tokens, we align incentives, reduce platform rent-seeking, and reignite the innovative explosion of the early internet. This isn't just about finance; it's about rebuilding digital democracy.",
    price: "0.06",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  },
  {
    id: "5",
    title: "L1 vs L2: The Geopolitics of Blockchain Scaling Solutions",
    author: "Haseeb Qureshi",
    snippet: "Will Ethereum Layer 2s cannibalize the base chain? We examine the economic flywheels of rollups, blob space fees, and security...",
    content: "Will Ethereum Layer 2s cannibalize the base chain? We examine the economic flywheels of rollups, blob space fees, and security. As Layer 2 execution becomes dirt cheap, value accrual moves to the settlement layer through L1 blob consumption. The geopolitics of blockchains suggest a future where L1s act as global supreme courts, and L2s act as high-speed commercial cities. This balance is critical to prevent fragmentation and secure long-term decentralization.",
    price: "0.05",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  }
];

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const UsdcCoinIcon = ({ size = 24, className = "", style = {} }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      className={`usdc-2d-coin ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <g fill="none">
        <circle fill="#2775CA" cx="16" cy="16" r="16"/>
        <g fill="#FFF">
          <path d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.243-2.193-.728-2.193-1.578 0-.85.61-1.396 1.828-1.396 1.097 0 1.707.364 2.011 1.275a.458.458 0 00.427.303h.975a.416.416 0 00.427-.425v-.06a3.04 3.04 0 00-2.743-2.489V9.142c0-.243-.183-.425-.487-.486h-.915c-.243 0-.426.182-.487.486v1.396c-1.829.242-2.986 1.456-2.986 2.974 0 2.002 1.218 2.791 3.778 3.095 1.707.303 2.255.668 2.255 1.639 0 .97-.853 1.638-2.011 1.638-1.585 0-2.133-.667-2.316-1.578-.06-.242-.244-.364-.427-.364h-1.036a.416.416 0 00-.426.425v.06c.243 1.518 1.219 2.61 3.23 2.914v1.457c0 .242.183.425.487.485h.915c.243 0 .426-.182.487-.485V21.34c1.829-.303 3.047-1.578 3.047-3.217z"/>
          <path d="M12.892 24.497c-4.754-1.7-7.192-6.98-5.424-11.653.914-2.55 2.925-4.491 5.424-5.402.244-.121.365-.303.365-.607v-.85c0-.242-.121-.424-.365-.485-.061 0-.183 0-.244.06a10.895 10.895 0 00-7.13 13.717c1.096 3.4 3.717 6.01 7.13 7.102.244.121.488 0 .548-.243.061-.06.061-.122.061-.243v-.85c0-.182-.182-.424-.365-.546zm6.46-18.936c-.244-.122-.488 0-.548.242-.061.061-.061.122-.061.243v.85c0 .243.182.485.365.607 4.754 1.7 7.192 6.98 5.424 11.653-.914 2.55-2.925 4.491-5.424 5.402-.244.121-.365.303-.365.607v.85c0 .242.121.424.365.485.061 0 .183 0 .244-.06a10.895 10.895 0 007.13-13.717c-1.096-3.46-3.778-6.07-7.13-7.162z"/>
        </g>
      </g>
    </svg>
  );
};

const VerifiedBadge = ({ onApplyClick }) => {
  const [showPopover, setShowPopover] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const handleTriggerClick = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: rect.left + rect.width / 2,
      y: rect.top - 8
    });
    setShowPopover(!showPopover);
  };

  const popoverWidth = 280;
  const padding = 16;
  let leftPos = coords.x - popoverWidth / 2;
  if (leftPos < padding) {
    leftPos = padding;
  } else if (leftPos + popoverWidth > window.innerWidth - padding) {
    leftPos = window.innerWidth - popoverWidth - padding;
  }
  const arrowLeft = coords.x - leftPos;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <svg 
        viewBox="0 0 24 24" 
        onClick={handleTriggerClick}
        style={{ 
          width: '14px', 
          height: '14px', 
          fill: '#1d9bf0', 
          display: 'inline-block', 
          verticalAlign: 'middle', 
          marginLeft: '4px', 
          cursor: 'pointer', 
          userSelect: 'none',
          flexShrink: 0
        }}
        title="Accredited Web3 Publisher - Click to verify"
      >
        <g>
          <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.17-2.9-.81-3.88-.98-.98-2.49-1.27-3.88-.81C14.67 2.66 13.43 1.75 12 1.75s-2.67.91-3.37 2.22C7.24 3.51 5.73 3.8 4.75 4.78c-.98.98-1.27 2.49-.81 3.88C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.17 2.9.81 3.88.98.98 2.49 1.27 3.88.81.7 1.31 1.94 2.22 3.37 2.22s2.67-.91 3.37-2.22c1.39.46 2.9.17 3.88-.81.98-.98 1.27-2.49.81-3.88 1.31-.7 2.22-1.94 2.22-3.37zM10.25 16.25L6 12l1.5-1.5 2.75 2.75 6.25-6.25 1.5 1.5-8 8z"></path>
        </g>
      </svg>

      {showPopover && (
        <>
          <div 
            onClick={(e) => {
              e.stopPropagation();
              setShowPopover(false);
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999
            }}
          />
          
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: `${leftPos}px`,
              top: `${coords.y}px`,
              transform: 'translateY(-100%)',
              width: `${popoverWidth}px`,
              backgroundColor: 'var(--paper-accent)',
              color: 'var(--ink-black)',
              border: '2px solid var(--ink-black)',
              padding: '16px',
              borderRadius: '0px',
              boxShadow: '4px 4px 0px var(--ink-black)',
              zIndex: 10000,
              textAlign: 'left',
              fontFamily: 'var(--font-serif)',
              fontSize: '13px',
              lineHeight: '1.5',
              pointerEvents: 'auto'
            }}
          >
            <div style={{ 
              fontFamily: 'var(--font-headline)', 
              fontWeight: 'bold', 
              fontSize: '15px', 
              color: 'var(--ink-red)', 
              borderBottom: '1px solid var(--ink-black)',
              paddingBottom: '6px',
              marginBottom: '12px' 
            }}>
              VERIFIED ACCOUNT
            </div>
            
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {/* Blue Verified Badge */}
              <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', fill: '#1d9bf0', marginRight: '10px', flexShrink: 0, marginTop: '2px' }}>
                <g>
                  <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.17-2.9-.81-3.88-.98-.98-2.49-1.27-3.88-.81C14.67 2.66 13.43 1.75 12 1.75s-2.67.91-3.37 2.22C7.24 3.51 5.73 3.8 4.75 4.78c-.98.98-1.27 2.49-.81 3.88C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.17 2.9.81 3.88.98.98 2.49 1.27 3.88.81.7 1.31 1.94 2.22 3.37 2.22s2.67-.91 3.37-2.22c1.39.46 2.9.17 3.88-.81.98-.98 1.27-2.49.81-3.88 1.31-.7 2.22-1.94 2.22-3.37zM10.25 16.25L6 12l1.5-1.5 2.75 2.75 6.25-6.25 1.5 1.5-8 8z"></path>
                </g>
              </svg>
              <div style={{ fontSize: '13px' }}>
                This account is verified.{' '}
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPopover(false);
                    onApplyClick();
                  }}
                  style={{ 
                    color: 'var(--ink-red)', 
                    cursor: 'pointer', 
                    textDecoration: 'underline', 
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px'
                  }}
                >
                  Learn more
                </span>
              </div>
            </div>
            
            {/* Popover Arrow */}
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              left: `${arrowLeft}px`,
              transform: 'translateX(-50%) rotate(45deg)',
              width: '10px',
              height: '10px',
              backgroundColor: 'var(--paper-accent)',
              borderRight: '2px solid var(--ink-black)',
              borderBottom: '2px solid var(--ink-black)',
              zIndex: 9999
            }} />
          </div>
        </>
      )}
    </span>
  );
};

function App() {
  const { logout, authenticated, user } = usePrivy();
  const { login } = useLogin({
    onComplete: (user, isNewUser, wasPreviouslyAuthenticated) => {
      console.log("[PaperCut] Login complete:", user);
      setError("");
    },
    onError: (err) => {
      console.error("[PaperCut] Login failed:", err);
      let errMsg = err?.message || String(err);
      if (errMsg.toLowerCase().includes("origin") || errMsg.toLowerCase().includes("domain") || errMsg.toLowerCase().includes("authorized") || errMsg.toLowerCase().includes("whitelist")) {
        errMsg = `Domain not authorized. Please log in to dashboard.privy.io, select App ID "cmqhlq3yb009i0ci5vvnjwqnf", and add "${window.location.origin}" to the Allowed Domains under settings.`;
      }
      setError(errMsg);
    }
  });
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

  const [showApplyForm, setShowApplyForm] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleOpenApplyForm = () => {
    setSelectedArticle(null);
    setShowApplyForm(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormSubmitted(true);
  };

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = date.toLocaleDateString('en-US', options);
    const timeString = date.toLocaleTimeString('en-US', { hour12: true });
    return `${dateString} — ${timeString}`;
  };

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

  const getUnlockedDetails = (artId) => {
    const val = unlockedArticles[artId];
    if (!val) return null;
    if (typeof val === 'object' && val !== null && 'txHash' in val) {
      return val;
    }
    if (typeof val === 'string') {
      return {
        txHash: val,
        isMock: val.startsWith("0x8fdc") || val.length === 66
      };
    }
    return {
      txHash: "0x8fdc9dfa539f8fc0d13cf941f81e14d3d4aa182035e0",
      isMock: true
    };
  };

  const handleViewTx = (e, artId) => {
    const details = getUnlockedDetails(artId);
    if (!details) return;
    
    if (details.isMock) {
      e.preventDefault();
      alert(`★ SIMULATED TRANSACTION ★\n\nThis app is currently running in Mock Mode because Circle API keys are not configured in Vercel.\n\nTransaction Hash: ${details.txHash}\nStatus: Settled (Simulated)\nChain: Arc Testnet (Simulated)\n\nNote: To run in Live Mode with real on-chain explorer validation, configure your CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in the Vercel project environment variables.`);
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
    if (!authenticated) {
      login();
      return;
    }
    setSelectedArticle(art);
    setShowApplyForm(false);
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
      const updatedUnlocked = { 
        ...unlockedArticles, 
        [selectedArticle.id]: {
          txHash: data.txHash || "0x8fdc9dfa539f8fc0d13cf941f81e14d3d4aa182035e0",
          isMock: !!data.isMock
        } 
      };
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
          <span className="logo-text">Paper Cut</span>
        </div>
        <div className="nav-controls">
          <div 
            className="nav-front-page-btn" 
            onClick={() => {
              setSelectedArticle(null);
              setShowApplyForm(false);
            }}
            title="Return to Front Page / Home"
            style={{ flex: 1, textAlign: 'left' }}
          >
            FRONT PAGE
          </div>
          <div className="nav-datetime mono-text" style={{ flex: 1, textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-grey)' }}>
            {formatDateTime(currentDate)}
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            {!authenticated ? (
              <span 
                className="nav-front-page-btn" 
                onClick={login}
                title="Sign the Register"
              >
                SIGN REGISTER
              </span>
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
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    By {art.author}
                    {art.verified && <VerifiedBadge onApplyClick={handleOpenApplyForm} />}
                  </span>
                  <span className="price-tag">
                    <UsdcCoinIcon size={12} className="coin-sidebar" style={{ marginRight: '3px', marginTop: '-2px' }} />
                    {art.price}
                  </span>
                </div>
                <div className={`card-snippet ${!authenticated ? 'blurred' : ''}`}>{art.snippet}</div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT CONTENT */}
        <section className="viewer">
          {showApplyForm ? (
            <div className="viewer-state apply-author-container" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
              <div className="greek-key"></div>
              <h1 className="serif-title font-italic" style={{ textAlign: 'center', marginBottom: '8px', fontSize: '32px' }}>Press Credentials Registry</h1>
              <p className="mono-text text-muted" style={{ textAlign: 'center', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                APPLICATION FOR AUTHOR INDUCTION & VERIFICATION SEAL
              </p>
              
              <div className="vintage-form-card" style={{ border: '2px solid var(--ink-black)', padding: '24px', backgroundColor: 'var(--paper-accent)', boxShadow: '4px 4px 0 var(--ink-black)', maxWidth: '600px', width: '100%', margin: '0 auto' }}>
                {formSubmitted ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉</div>
                    <h2 className="serif-title" style={{ fontSize: '22px', color: 'var(--ink-red)', marginBottom: '12px' }}>APPLICATION RECEIVED</h2>
                    <p className="mono-text" style={{ fontSize: '11px', lineHeight: '1.6', maxWidth: '420px', margin: '0 auto', color: 'var(--ink-grey)' }}>
                      Your credentials and cryptographic signature have been cataloged in our archives. The Press Board will review your application on-chain. Verification status will update within 24 blocks.
                    </p>
                    <button 
                      className="btn btn-sm" 
                      style={{ marginTop: '24px', padding: '6px 16px' }}
                      onClick={() => {
                        setFormSubmitted(false);
                        setShowApplyForm(false);
                      }}
                    >
                      RETURN TO COVER
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>1. PUBLISHER PSEUDONYM / LEGAL NAME</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Satoshi Nakamoto" 
                        style={{ padding: '8px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-serif)', fontSize: '13px' }}
                      />
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>2. CRYPTOGRAPHIC ACCOUNT (CIRCLE WALLET)</label>
                      <input 
                        type="text" 
                        disabled 
                        value={circleWallet?.address || "NOT LOGGED IN (Vault Inactive)"} 
                        style={{ padding: '8px', border: '1px solid var(--ink-light-grey)', background: 'var(--paper-bg-darker)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-grey)' }}
                      />
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>3. EDITORIAL BEAT / CATEGORY</label>
                      <select style={{ padding: '8px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-serif)', fontSize: '13px' }}>
                        <option>Web3 Infrastructures & Protocols</option>
                        <option>AI-Agent Autonomous Economics</option>
                        <option>Decentralized High-Performance Compute</option>
                        <option>On-Chain Micropayments & L2 Scaling</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>4. BIOGRAPHY & PREVIOUS ACCREDITATIONS</label>
                      <textarea 
                        required 
                        rows="4" 
                        placeholder="Detail your experience in the web3 space or links to prior published works..."
                        style={{ padding: '8px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-serif)', fontSize: '13px', resize: 'vertical' }}
                      />
                    </div>

                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '6px' }}>
                      <input type="checkbox" required id="sybil-check" style={{ marginTop: '3px' }} />
                      <label htmlFor="sybil-check" style={{ fontFamily: 'var(--font-serif)', fontSize: '10.5px', color: 'var(--ink-grey)', lineHeight: '1.4', cursor: 'pointer' }}>
                        I authorize a 0.01 USDC Sybil-resistance micro-signature check from my active Ledger Vault upon submission.
                      </label>
                    </div>

                    <button type="submit" className="btn" style={{ padding: '10px 0', marginTop: '8px', letterSpacing: '0.06em', fontSize: '12px' }}>
                      SUBMIT ACCREDITATION FORM
                    </button>
                  </form>
                )}
              </div>
              <div className="greek-key" style={{ marginTop: '32px' }}></div>
            </div>
          ) : !selectedArticle ? (
            <div id="viewer-default" className="viewer-state">
              <img 
                src={logoImg} 
                alt="Paper Cut Seal" 
                className="home-logo-large" 
                style={{ 
                  height: '140px', 
                  width: '140px', 
                  borderRadius: '50%', 
                  border: '2px solid var(--ink-black)',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)'
                }} 
              />
              <div className="greek-key"></div>
              <h1 className="serif-title font-italic">Select a Dispatch to Peruse</h1>
              <p className="mono-text text-muted">Demonstrating a Modern Electronic Ledger & Gasless Micro-Tariff System.</p>
              
              {error && (
                <div className="login-error-alert" style={{ 
                  border: '2px dashed var(--ink-red)', 
                  backgroundColor: 'rgba(186, 45, 45, 0.08)', 
                  color: 'var(--ink-red)', 
                  padding: '16px', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '12px',
                  lineHeight: '1.6',
                  maxWidth: '550px',
                  margin: '20px auto 10px auto',
                  textAlign: 'left',
                  borderRadius: '0px',
                  boxShadow: '3px 3px 0 rgba(186, 45, 45, 0.15)'
                }}>
                  <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '16px' }}>⚠</span> AUTHENTICATION ERROR
                  </div>
                  <div>{error}</div>
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(186, 45, 45, 0.25)', fontSize: '11px', color: 'var(--ink-grey)' }}>
                    <strong>Next Steps:</strong>
                    <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      <li>Ensure <strong>{window.location.origin}</strong> is added to <strong>Allowed Domains</strong> in the Privy Developer Dashboard (dashboard.privy.io) under settings.</li>
                      <li>Try clearing browser cookies/site data and reloading the page.</li>
                      <li>Check if MetaMask extension has any pending connection approvals.</li>
                    </ol>
                  </div>
                </div>
              )}
              <div className="stamp-row">
                {/* Stamp 1: Register Status */}
                {!authenticated ? (
                  <div 
                    className="rubber-stamp stamp-red clickable-stamp" 
                    onClick={login}
                    title="Click to Sign the Register"
                  >
                    ★ REGISTER: UNSIGNED ★
                  </div>
                ) : (
                  <div className="rubber-stamp stamp-green">
                    ✔ REGISTER: SIGNED
                  </div>
                )}

                {/* Stamp 2: Vault Status */}
                {(!authenticated || !circleWallet) ? (
                  <div 
                    className="rubber-stamp stamp-red clickable-stamp"
                    onClick={login}
                    title="Click to Sign Register and activate Vault"
                  >
                    ★ VAULT: EMPTY ★
                  </div>
                ) : (
                  <div 
                    className="rubber-stamp stamp-green clickable-stamp"
                    onClick={() => setShowWalletModal(true)}
                    title="Click to open your Secure Ledger Vault"
                  >
                    ✔ VAULT: ACTIVE
                  </div>
                )}

                {/* Stamp 3: Network Status */}
                <div className="rubber-stamp stamp-black">
                  ✦ ARC TESTNET ✦
                </div>
              </div>
            </div>
          ) : (
            <div id="viewer-active" className="viewer-state">
              <div className="article-header">
                <h1 className="serif-title">{selectedArticle.title}</h1>
                <div className="article-meta">
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    By <strong style={{ color: 'var(--ink-black)', marginRight: '2px', marginLeft: '4px' }}>{selectedArticle.author}</strong>
                    {selectedArticle.verified && <VerifiedBadge onApplyClick={handleOpenApplyForm} />}
                  </span>
                  <span className="divider">•</span>
                  <span className="price-badge">
                    TARIFF: <UsdcCoinIcon size={14} className="coin-inline" style={{ marginRight: '4px', marginTop: '-3px' }} /> {selectedArticle.price} USDC Coinage
                    {getUnlockedDetails(selectedArticle.id) && (
                      <a 
                        href={getExplorerUrl("5042002", getUnlockedDetails(selectedArticle.id).txHash)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={(e) => handleViewTx(e, selectedArticle.id)}
                        title={getUnlockedDetails(selectedArticle.id).isMock ? "Simulated Transaction - Click for info" : "View transaction on-chain"}
                        style={{ marginLeft: '6px', textDecoration: 'none', display: 'inline-block', fontSize: '13px', cursor: 'pointer' }}
                      >
                        🔗
                      </a>
                    )}
                  </span>
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
                                      Tx settled. Hash: <a href={getExplorerUrl(chainId || "5042002", "0x8fdc9dfa539f8fc0d13cf941f81e14d3d4aa182035e0")} target="_blank" rel="noopener noreferrer" style={{ color: '#5cd15c', textDecoration: 'underline' }}>0x8fd...35e0 ↗</a>.
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
                                View on Block Explorer ↗
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
                <div className="wallet-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div className="wallet-seal">★ OFFICIAL IDENTITY CARD ★</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '6px' }}>
                    <img src={logoImg} alt="Paper Cut Seal Logo" style={{ height: '40px', width: '40px', borderRadius: '50%', border: '1.5px solid var(--ink-black)' }} />
                    <h3 className="wallet-title" style={{ margin: 0 }}>PAPER CUT</h3>
                  </div>
                  <div className="wallet-subtitle" style={{ marginTop: '4px' }}>TARIFF ACCOUNT & PORTFOLIO</div>
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
