import React, { useCallback, useState, useEffect, useMemo, useReducer, useRef } from 'react';
import { useIdentityToken, useLogin, useLoginWithEmail, usePrivy } from '@privy-io/react-auth';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import './App.css';
import logoImg from './assets/logo.png';
import { resilientAuthFetch } from './apiClient.js';
import { sendEmailCodeWithSessionRecovery } from './privyAuthRecovery.js';
import { getBackendBaseUrl } from './runtimeConfig.js';
import { collectLegacyEntitlementReceipts } from './legacyEntitlements.js';
import {
  initialReaderLifecycle,
  pendingPaymentOperations,
  readerLifecycleReducer,
  WALLET_PHASE,
} from './readerLifecycle.js';

const INITIAL_ARTICLES = [
  {
    id: "0",
    title: "Exploring the Antigravity of Decentralized Liquidity",
    author: "Hayden Adams",
    snippet: "How automated market makers and concentrated liquidity protocols are redefining financial architecture without intermediaries...",
    price: "0.05",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  },
  {
    id: "1",
    title: "The Promise and Challenges of Crypto-Pluralism",
    author: "Vitalik Buterin",
    snippet: "Pluralism in the digital age requires decentralized governance models that respect individual sovereignty while fostering coordination...",
    price: "0.08",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  },
  {
    id: "2",
    title: "The Rise of the Startup Society and Cloud First Cities",
    author: "Balaji Srinivasan",
    snippet: "Physical nations are slow, bureaucratic, and bound to geographical legacy. The startup society starts cloud-first, building digital...",
    price: "0.10",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  },
  {
    id: "3",
    title: "Ultra-Sound Money: Analysing the Deflationary Mechanics of EIP-1559",
    author: "Bankless",
    snippet: "Is Ethereum truly ultra-sound? Let's dissect the base fee burn mechanism and how network transaction fee demand impacts ether supply...",
    price: "0.04",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  },
  {
    id: "4",
    title: "Read, Write, Own: How Web3 Restores the Original Vision of the Internet",
    author: "Chris Dixon",
    snippet: "Web1 was read-only, dominated by open protocols. Web2 added write capabilities, but centralized the power in corporate platforms. Web3...",
    price: "0.06",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  },
  {
    id: "5",
    title: "L1 vs L2: The Geopolitics of Blockchain Scaling Solutions",
    author: "Haseeb Qureshi",
    snippet: "Will Ethereum Layer 2s cannibalize the base chain? We examine the economic flywheels of rollups, blob space fees, and security...",
    price: "0.05",
    payee: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    verified: true
  }
];

const INITIAL_SURFAI_ARTICLE = {
  id: "surfai-daily",
  title: "SurfAI Daily Intelligence Dispatch",
  author: "DaveyNFTs",
  category: "AI-Agent Autonomous Economics",
  price: "0.15",
  payee: "0x1746978f956142e0482f0aff320d917ace450bcf",
  verified: true,
  snippet: "An advanced programmatic intelligence report compiled automatically by the SurfAI pipeline on daily capital flows, sovereign resource allocations, and micro-tariffs.",
};

const BACKEND_URL = getBackendBaseUrl({
  configuredUrl: import.meta.env.VITE_API_URL,
  location: typeof window === "undefined" ? undefined : window.location,
});

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

const SurfAILogo = ({ size = 36 }) => (
  <span className="surfai-mark" style={{ '--surfai-mark-size': `${size}px` }} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" focusable="false">
      <path d="M2 7C4.5 5 7.5 5 10 7C12.5 9 15.5 9 18 7C19.5 5.8 21 6.2 22 7" />
      <path d="M2 12C4.5 10 7.5 10 10 12C12.5 14 15.5 14 18 12C19.5 10.8 21 11.2 22 12" />
      <path d="M2 17C4.5 15 7.5 15 10 17C12.5 19 15.5 19 18 17C19.5 15.8 21 16.2 22 17" />
    </svg>
  </span>
);

const VerifiedBadge = ({ onApplyClick }) => {
  const [showPopover, setShowPopover] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!showPopover) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowPopover(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showPopover]);

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
      <button
        type="button"
        className="verified-badge-button"
        onClick={handleTriggerClick}
        aria-label="View verified publisher details"
        aria-expanded={showPopover}
        title="Verified publisher details"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <g>
            <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.17-2.9-.81-3.88-.98-.98-2.49-1.27-3.88-.81C14.67 2.66 13.43 1.75 12 1.75s-2.67.91-3.37 2.22C7.24 3.51 5.73 3.8 4.75 4.78c-.98.98-1.27 2.49-.81 3.88C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.17 2.9.81 3.88.98.98 2.49 1.27 3.88.81.7 1.31 1.94 2.22 3.37 2.22s2.67-.91 3.37-2.22c1.39.46 2.9.17 3.88-.81.98-.98 1.27-2.49.81-3.88 1.31-.7 2.22-1.94 2.22-3.37zM10.25 16.25L6 12l1.5-1.5 2.75 2.75 6.25-6.25 1.5 1.5-8 8z"></path>
          </g>
        </svg>
      </button>

      {showPopover && (
        <>
          <div 
            aria-hidden="true"
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
            role="dialog"
            aria-label="Verified publisher details"
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
                <button
                  type="button"
                  className="verified-learn-more"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPopover(false);
                    onApplyClick();
                  }}
                >
                  Learn more
                </button>
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

// --- Bug Fix Helpers ---
const isValidEthAddress = (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr);

const safeParseResponse = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    return { error: text || `HTTP Error ${response.status}` };
  }
};

const isDomainAuthorizationError = (message) => {
  const normalized = String(message || "").toLowerCase();
  return ["origin", "domain", "authorized", "whitelist"].some(term => normalized.includes(term));
};

function App() {
  const { ready, logout, authenticated, user, getAccessToken } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { sendCode: sendEmailCode, loginWithCode: loginWithEmailCode } = useLoginWithEmail();
  const { login } = useLogin({
    onComplete: () => {
      setShowSignInModal(false);
      setSignInError("");
      setError("");
    },
    onError: (loginError) => {
      console.error("[PaperCut] Wallet sign-in failed:", loginError);
      setSignInError(loginError?.message || "Could not connect the wallet. Please try again.");
    },
  });

  const authFetch = useCallback(async (url, options = {}) => {
    return resilientAuthFetch(url, options, {
      authenticated,
      getAccessToken,
      identityToken,
      fetchImpl: window.fetch.bind(window),
    });
  }, [authenticated, getAccessToken, identityToken]);

  const [readerLifecycle, dispatchReaderLifecycle] = useReducer(
    readerLifecycleReducer,
    initialReaderLifecycle,
  );
  const pendingPayments = useMemo(
    () => pendingPaymentOperations(readerLifecycle),
    [readerLifecycle],
  );
  const authPhase = !ready ? 'initializing' : authenticated ? 'authenticated' : 'signed-out';

  const waitForPaymentOperation = async (initialData) => {
    if (!initialData?.pending || !initialData.transactionId) return initialData;
    dispatchReaderLifecycle({ type: 'PAYMENT_UPDATE', operation: initialData });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 1000));
      const response = await authFetch(`${BACKEND_URL}/api/transactions/${initialData.transactionId}`);
      const data = await safeParseResponse(response);
      const operation = { ...initialData, ...data };
      dispatchReaderLifecycle({ type: 'PAYMENT_UPDATE', operation });
      if (data.status === 'COMPLETE') return { ...operation, pending: false, success: true };
      if (!response.ok || data.status === 'FAILED') throw new Error(data.error || 'Payment operation failed.');
    }
    const pendingError = new Error('Payment was submitted and is still confirming. It will continue in My Library automatically.');
    pendingError.paymentPending = true;
    pendingError.transactionId = initialData.transactionId;
    throw pendingError;
  };

  const [circleWallet, setCircleWallet] = useState(null);
  const walletRequestRef = useRef(null);
  const walletRequestGenerationRef = useRef(0);
  const smartWalletAddress = circleWallet?.address;

  const [selectedArticle, setSelectedArticle] = useState(null);
  const [unlockedArticles, setUnlockedArticles] = useState({});
  const [isLibraryView, setIsLibraryView] = useState(false);
  const [library, setLibrary] = useState({
    items: [],
    pending: [],
    summary: { totalItems: 0, totalSpent: '0.00', currency: 'USDC' },
  });
  const [libraryPhase, setLibraryPhase] = useState('idle');
  const [libraryError, setLibraryError] = useState('');
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState("");
  const chainId = "5042002";
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInCode, setSignInCode] = useState("");
  const [signInStep, setSignInStep] = useState("email");
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState("");

  const openLogin = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (authenticated) return;
    setError("");
    setSignInError("");
    setShowSignInModal(true);
  }, [authenticated]);

  const closeSignInModal = useCallback(() => {
    if (signInBusy) return;
    setShowSignInModal(false);
    setSignInStep("email");
    setSignInCode("");
    setSignInError("");
  }, [signInBusy]);

  useEffect(() => {
    if (!ready || authenticated) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("walletLogin") !== "1") return;

    url.searchParams.delete("walletLogin");
    window.history.replaceState({}, "", url);
    setShowSignInModal(false);
    login({ loginMethods: ["wallet"] });
  }, [authenticated, login, ready]);

  const handleWalletSignIn = async () => {
    setSignInError("");
    if (ready) {
      setShowSignInModal(false);
      login({ loginMethods: ["wallet"] });
      return;
    }

    // Failed session refreshes can also leave Privy's wallet UI unready.
    // Clear the stale local session, remount the provider, and resume the
    // wallet intent once initialization succeeds.
    setSignInBusy(true);
    try {
      await logout();
      const url = new URL(window.location.href);
      url.searchParams.set("walletLogin", "1");
      window.location.replace(url);
    } catch (walletError) {
      console.error("[PaperCut] Could not recover wallet sign-in:", walletError);
      setSignInError("Could not prepare wallet sign-in. Please reload and try again.");
      setSignInBusy(false);
    }
  };

  const handleSendSignInCode = async (event) => {
    event.preventDefault();
    const email = signInEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setSignInError("Enter a valid email address.");
      return;
    }
    setSignInBusy(true);
    setSignInError("");
    try {
      await sendEmailCodeWithSessionRecovery({
        email,
        sendCode: sendEmailCode,
        clearSession: logout,
      });
      setSignInEmail(email);
      setSignInStep("code");
    } catch (err) {
      console.error("[PaperCut] Could not send sign-in code:", err);
      setSignInError(err?.message || "Could not send the sign-in code. Please try again.");
    } finally {
      setSignInBusy(false);
    }
  };

  const handleVerifySignInCode = async (event) => {
    event.preventDefault();
    const code = signInCode.trim();
    if (!code) {
      setSignInError("Enter the code sent to your email.");
      return;
    }

    setSignInBusy(true);
    setSignInError("");
    try {
      await loginWithEmailCode({ code });
      setShowSignInModal(false);
      setSignInStep("email");
      setSignInCode("");
      setError("");
    } catch (err) {
      console.error("[PaperCut] Could not verify sign-in code:", err);
      setSignInError(err?.message || "The sign-in code is invalid or expired.");
    } finally {
      setSignInBusy(false);
    }
  };
  
  // SurfAI PDF simulation states
  const [pdfSimulating, setPdfSimulating] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfSimStep, setPdfSimStep] = useState(0);
  
  // SurfAI Video Mockup States
  const [showSurfVideoMockup, setShowSurfVideoMockup] = useState(false);
  const [videoSimulating, setVideoSimulating] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoSimStep, setVideoSimStep] = useState(0);
  const [surfVideoUrl, setSurfVideoUrl] = useState("");
  const [surfRequestedAsset, setSurfRequestedAsset] = useState("");

  // Publisher Admin Portal States
  const [articles, setArticles] = useState(INITIAL_ARTICLES);
  const [surfAIArticle, setSurfAIArticle] = useState(INITIAL_SURFAI_ARTICLE);
  const [publishers, setPublishers] = useState({});
  const [isAdminView, setIsAdminView] = useState(false);
  const [isPublisherView, setIsPublisherView] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminDomain, setAdminDomain] = useState("");
  const [adminWallet, setAdminWallet] = useState("");
  const [adminCategory, setAdminCategory] = useState("Web3 Infrastructures & Protocols");
  const [adminStatusMsg, setAdminStatusMsg] = useState("");
  const [surfAIAdminDraft, setSurfAIAdminDraft] = useState({
    title: INITIAL_SURFAI_ARTICLE.title,
    snippet: INITIAL_SURFAI_ARTICLE.snippet,
    content: "",
    price: INITIAL_SURFAI_ARTICLE.price,
    pdfUrl: "",
    videoUrl: "",
  });
  const [surfAIAdminPhase, setSurfAIAdminPhase] = useState("idle");
  const [surfAIAdminStatus, setSurfAIAdminStatus] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState("");

  // Publisher Portal states
  const [pubFormName, setPubFormName] = useState("");
  const [pubFormDomain, setPubFormDomain] = useState("");
  const [pubFormWallet, setPubFormWallet] = useState("");
  const [pubFormCategory, setPubFormCategory] = useState("Web3 Infrastructures & Protocols");
  const [pubFormStatusMsg, setPubFormStatusMsg] = useState("");
  const [pubEarnings, setPubEarnings] = useState(0);
  const [pubClaimed, setPubClaimed] = useState(0);
  const [pubClaiming, setPubClaiming] = useState(false);
  const [pubClaimSuccess, setPubClaimSuccess] = useState("");

  const [publisherTab, setPublisherTab] = useState("ledger");
  const [newArticleTitle, setNewArticleTitle] = useState(() => {
    return localStorage.getItem("papercut_draft_title") || "";
  });
  const [newArticlePrice, setNewArticlePrice] = useState(() => {
    return localStorage.getItem("papercut_draft_price") || "0.05";
  });
  const [newArticleContent, setNewArticleContent] = useState(() => {
    return localStorage.getItem("papercut_draft_content") || "";
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatusMsg, setPublishStatusMsg] = useState("");
  const [showMdGuide, setShowMdGuide] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isEditingSubmit, setIsEditingSubmit] = useState(false);
  const [editStatusMsg, setEditStatusMsg] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");

  useEffect(() => {
    localStorage.setItem("papercut_draft_title", newArticleTitle);
    localStorage.setItem("papercut_draft_price", newArticlePrice);
    localStorage.setItem("papercut_draft_content", newArticleContent);
  }, [newArticleTitle, newArticlePrice, newArticleContent]);

  const parseMarkdownToHtml = (text) => {
    if (!text) return "";
    const rendered = marked.parse(String(text), { gfm: true, breaks: true });
    return DOMPurify.sanitize(rendered, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ['video', 'source'],
      ADD_ATTR: ['controls'],
      FORBID_TAGS: ['style', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['style'],
    });
  };

  const generateClientSnippet = (content) => {
    if (!content) return "";
    let cleanText = content.replace(/^#+\s+/gm, "");
    cleanText = cleanText
      .replace(/^>\s+/gm, "")
      .replace(/^[\s-*+]+(.*?)$/gm, "$1")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    cleanText = cleanText.replace(/\s+/g, " ").trim();
    if (cleanText.length <= 200) {
      return cleanText + (cleanText.endsWith("...") ? "" : "...");
    }
    let snippet = cleanText.substring(0, 197);
    const lastSpace = snippet.lastIndexOf(" ");
    if (lastSpace > 150) {
      snippet = snippet.substring(0, lastSpace);
    }
    return snippet + "...";
  };

  const insertMarkdown = (syntax, isEdit = false) => {
    const textareaId = isEdit ? "dispatch-editor-textarea-edit" : "dispatch-editor-textarea";
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = isEdit ? editContent : newArticleContent;
    const selectedText = text.substring(start, end);
    let replacement = "";
    if (syntax === "h1") {
      replacement = `\n# ${selectedText || "Heading 1"}\n`;
    } else if (syntax === "h2") {
      replacement = `\n## ${selectedText || "Heading 2"}\n`;
    } else if (syntax === "h3") {
      replacement = `\n### ${selectedText || "Heading 3"}\n`;
    } else if (syntax === "bold") {
      replacement = `**${selectedText || "bold text"}**`;
    } else if (syntax === "italic") {
      replacement = `*${selectedText || "italic text"}*`;
    } else if (syntax === "code") {
      replacement = `\`${selectedText || "code text"}\``;
    } else if (syntax === "codeblock") {
      replacement = `\n\`\`\`javascript\n${selectedText || "// code block"}\n\`\`\`\n`;
    } else if (syntax === "link") {
      replacement = `[${selectedText || "Link Text"}](https://example.com)`;
    } else if (syntax === "quote") {
      replacement = `\n> ${selectedText || "Blockquote text"}\n`;
    } else if (syntax === "list") {
      replacement = `\n- ${selectedText || "List item"}\n`;
    }
    const newText = text.substring(0, start) + replacement + text.substring(end);
    if (isEdit) {
      setEditContent(newText);
    } else {
      setNewArticleContent(newText);
    }
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + replacement.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleImportMarkdown = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (isEdit) {
        setEditContent(event.target.result || "");
      } else {
        setNewArticleContent(event.target.result || "");
      }
    };
    reader.readAsText(file);
  };

  const getWordCount = (text) => {
    if (!text) return 0;
    const cleanText = text.trim().replace(/\s+/g, ' ');
    return cleanText ? cleanText.split(' ').length : 0;
  };

  const handleClearDraft = () => {
    if (window.confirm("Are you sure you want to clear your current draft? This will wipe the title, price, and content.")) {
      setNewArticleTitle("");
      setNewArticlePrice("0.05");
      setNewArticleContent("");
      setPublishStatusMsg("Draft cleared.");
      setTimeout(() => setPublishStatusMsg(""), 3000);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewArticleContent(event.target.result || "");
        setPublishStatusMsg("Markdown file loaded successfully via drag-and-drop!");
        setTimeout(() => setPublishStatusMsg(""), 3000);
      };
      reader.readAsText(file);
    } else {
      setPublishStatusMsg("Please drop a valid .md or .txt file.");
      setTimeout(() => setPublishStatusMsg(""), 3000);
    }
  };

  const handleEditorScroll = (e) => {
    const textarea = e.target;
    const previewPane = document.querySelector(".markdown-render");
    if (!previewPane) return;
    
    const scrollableHeight = textarea.scrollHeight - textarea.clientHeight;
    if (scrollableHeight <= 0) return;
    
    const scrollPct = textarea.scrollTop / scrollableHeight;
    previewPane.scrollTop = scrollPct * (previewPane.scrollHeight - previewPane.clientHeight);
  };

  const fetchFullArticleContent = useCallback(async (articleId) => {
    try {
      const response = await authFetch(`${BACKEND_URL}/api/articles/${articleId}`);
      const data = await safeParseResponse(response);
      if (response.ok && data.success && data.content) {
        const protectedFields = {
          content: data.content,
          ...(data.pdfUrl ? { pdfUrl: data.pdfUrl } : {}),
          ...(data.videoUrl ? { videoUrl: data.videoUrl } : {}),
        };
        setArticles(prev => prev.map(art => art.id === articleId ? { ...art, ...protectedFields } : art));
        setSelectedArticle(prev => prev && prev.id === articleId ? { ...prev, ...protectedFields } : prev);
        return protectedFields;
      }
      throw new Error(data.error || 'Article access has not been granted by the server.');
    } catch (err) {
      console.error("Failed to fetch full article content:", err);
      setError(err.message || 'Unable to load protected article content.');
    }
  }, [authFetch]);

  useEffect(() => {
    if (selectedArticle && unlockedArticles[selectedArticle.id] && !selectedArticle.content) {
      fetchFullArticleContent(selectedArticle.id);
    }
  }, [fetchFullArticleContent, selectedArticle, unlockedArticles]);

  useEffect(() => {
    if (authenticated && unlockedArticles["surfai-daily"]) return;
    setSurfVideoUrl("");
    setShowSurfVideoMockup(false);
    setVideoSimulating(false);
    setVideoReady(false);
    setVideoSimStep(0);
  }, [authenticated, unlockedArticles]);

  const fetchArticles = useCallback(async () => {
    try {
      const response = await authFetch(`${BACKEND_URL}/api/articles`);
      const data = await safeParseResponse(response);
      if (!response.ok || !Array.isArray(data)) throw new Error(data.error || 'Failed to load articles.');
      const allArticles = data.map(article => ({ ...article, content: article.content || undefined }));
      allArticles.sort((a, b) => {
        const idA = parseInt(a.id, 10) || 0;
        const idB = parseInt(b.id, 10) || 0;
        if (idA !== idB) {
          return idB - idA;
        }
        return b.id.localeCompare(a.id);
      });
      
      setArticles(allArticles);
    } catch (err) {
      console.error("Failed to fetch articles:", err);
      setArticles(INITIAL_ARTICLES);
    }
  }, [authFetch]);

  const fetchSurfAIMetadata = useCallback(async () => {
    try {
      const response = await authFetch(`${BACKEND_URL}/api/surfai`);
      const data = await safeParseResponse(response);
      if (!response.ok) throw new Error(data.error || 'Failed to load SurfAI metadata.');
      setSurfAIArticle({ ...INITIAL_SURFAI_ARTICLE, ...data });
      setSelectedArticle((current) => current?.id === 'surfai-daily'
        ? { ...current, ...data }
        : current);
      return data;
    } catch (surfAIError) {
      console.error('Failed to fetch SurfAI metadata:', surfAIError);
      return null;
    }
  }, [authFetch]);

  const fetchPublishers = useCallback(async () => {
    try {
      const response = await authFetch(`${BACKEND_URL}/api/publishers`);
      if (response.ok) {
        const data = await response.json();
        const normalized = {};
        Object.keys(data).forEach(key => {
          normalized[key.toLowerCase()] = data[key];
        });
        setPublishers(normalized);
      }
    } catch (err) {
      console.error("Failed to fetch publishers:", err);
    }
  }, [authFetch]);

  const getPublisherRecord = useCallback((email) => {
    if (!publishers || !email) return null;
    return publishers[email.toLowerCase()] || null;
  }, [publishers]);

  // Handle URL subpath routing for /admin, /papercut/admin, or hash #/admin / #/publisher
  useEffect(() => {
    const checkPath = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (
        path.endsWith('/admin') || 
        path.endsWith('/admin/') || 
        hash === '#/admin' || 
        hash === '#/admin/' || 
        hash.endsWith('/admin')
      ) {
        setIsAdminView(true);
        setIsPublisherView(false);
      } else if (
        path.endsWith('/publisher') || 
        path.endsWith('/publisher/') || 
        hash === '#/publisher' || 
        hash === '#/publisher/' || 
        hash.endsWith('/publisher')
      ) {
        setIsAdminView(false);
        setIsPublisherView(true);
      } else {
        setIsAdminView(false);
        setIsPublisherView(false);
      }
    };
    checkPath();

    window.addEventListener('popstate', checkPath);
    window.addEventListener('hashchange', checkPath);
    return () => {
      window.removeEventListener('popstate', checkPath);
      window.removeEventListener('hashchange', checkPath);
    };
  }, []);

  // Prefill wallet address in the publisher registration form
  useEffect(() => {
    if (smartWalletAddress || user?.wallet?.address) {
      setPubFormWallet(smartWalletAddress || user?.wallet?.address || "");
    }
  }, [smartWalletAddress, user]);

  const userEmail = user?.email?.address || user?.id || "";

  // Dynamic earnings calculation for verified publishers
  useEffect(() => {
    const pubRecord = getPublisherRecord(userEmail);
    if (isPublisherView && userEmail && pubRecord && pubRecord.verified) {
      const globalEarned = parseFloat(pubRecord.totalEarned || "0");
      const globalClaimed = parseFloat(pubRecord.totalClaimed || "0");
      
      setPubEarnings(globalEarned);
      setPubClaimed(globalClaimed);
    }
  }, [getPublisherRecord, isPublisherView, userEmail]);

  const handlePublishArticleSubmit = async (e) => {
    e.preventDefault();
    if (!newArticleTitle || !newArticleContent || !newArticlePrice) {
      setPublishStatusMsg("Please fill in all fields.");
      return;
    }
    
    setIsPublishing(true);
    setPublishStatusMsg("Publishing dispatch to database...");
    
    try {
      const response = await authFetch(`${BACKEND_URL}/api/articles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: newArticleTitle,
          content: newArticleContent,
          price: newArticlePrice
        })
      });
      
      const data = await safeParseResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Failed to publish article.");
      }
      
      setPublishStatusMsg("Article published successfully!");
      setNewArticleTitle("");
      setNewArticleContent("");
      
      await fetchArticles();
      
      setTimeout(() => {
        setPublisherTab("ledger");
        setPublishStatusMsg("");
      }, 1500);
      
    } catch (err) {
      console.error("Publish article error:", err);
      setPublishStatusMsg(err.message || "Failed to publish article.");
    } finally {
      setIsPublishing(false);
    }
  };

  const startEditing = async (art) => {
    setEditingArticle(art);
    setEditTitle(art.title);
    setEditPrice(art.price);
    setEditContent("");
    setEditStatusMsg("Loading content...");

    // If content is already present (e.g. from local storage), use it
    if (art.content) {
      setEditContent(art.content);
      setEditStatusMsg("");
      return;
    }

    // Otherwise, fetch it from server
    try {
      const rawId = art.id.replace("local-", "");
      const response = await authFetch(`${BACKEND_URL}/api/articles/${rawId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.content) {
          setEditContent(data.content);
          setEditStatusMsg("");
          return;
        }
      }
    } catch (err) {
      console.error("Failed to fetch full article for editing:", err);
    }

    setEditStatusMsg("Unable to load the protected article content.");
  };

  const handleEditArticleSubmit = async (e) => {
    e.preventDefault();
    if (!editingArticle || !editTitle || !editContent || !editPrice) {
      setEditStatusMsg("Please fill in all fields.");
      return;
    }

    setIsEditingSubmit(true);
    setEditStatusMsg("Saving updates on server...");

    const rawId = editingArticle.id.replace("local-", "");

    try {
      const response = await authFetch(`${BACKEND_URL}/api/articles/${rawId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          price: editPrice
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update article.");
      }

      setEditStatusMsg("Article updated successfully!");
      
      // If we are currently viewing the updated article, refresh it in the viewer too
      if (selectedArticle && selectedArticle.id === editingArticle.id) {
        setSelectedArticle(prev => ({
          ...prev,
          title: editTitle,
          content: editContent,
          price: data.article?.price || editPrice,
          snippet: data.article?.snippet || prev.snippet
        }));
      }

      setEditingArticle(null);
      setEditTitle("");
      setEditContent("");
      setEditPrice("");
      setEditStatusMsg("");
      await fetchArticles();

    } catch (err) {
      console.error("Failed to edit article:", err);
      setEditStatusMsg(err.message || "Failed to update article.");
    } finally {
      setIsEditingSubmit(false);
    }
  };

  const handleDeleteArticle = async (articleToDelete) => {
    if (!window.confirm(`Are you certain you want to delete the dispatch "${articleToDelete.title}"? This action is permanent.`)) {
      return;
    }

    const rawId = articleToDelete.id;

    try {
      const response = await authFetch(`${BACKEND_URL}/api/articles/${rawId}`, {
        method: "DELETE"
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete article.");
      }

      alert("Dispatch deleted successfully.");
      
      // If we are currently viewing the deleted article, clear selectedArticle
      if (selectedArticle && selectedArticle.id === articleToDelete.id) {
        setSelectedArticle(null);
      }

      await fetchArticles();

    } catch (err) {
      console.error("Failed to delete article:", err);
      alert(err.message || "Failed to delete dispatch.");
    }
  };

  const handleApplyPublisherSubmit = async (e) => {
    e.preventDefault();
    setPubFormStatusMsg("Submitting application...");

    if (pubFormWallet && !isValidEthAddress(pubFormWallet)) {
      setPubFormStatusMsg("Error: Please enter a valid Ethereum wallet address (0x...).");
      return;
    }

    try {
      const response = await authFetch(`${BACKEND_URL}/api/publishers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: pubFormName,
          domain: pubFormDomain,
          walletAddress: pubFormWallet,
          category: pubFormCategory
        })
      });
      const data = await safeParseResponse(response);
      if (response.ok) {
        setPubFormStatusMsg("Application submitted! Linked directly to Admin Board for approval.");
        setPubFormName("");
        setPubFormDomain("");
        fetchPublishers();
      } else {
        setPubFormStatusMsg(data.error || "Failed to submit application.");
      }
    } catch (err) {
      console.error(err);
      setPubFormStatusMsg("Connection to server failed.");
    }
  };

  const handlePublisherClaim = async () => {
    if (pubEarnings - pubClaimed <= 0) return;
    setPubClaiming(true);
    setPubClaimSuccess("");
    try {
      const response = await authFetch(`${BACKEND_URL}/api/publishers/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      let data = await safeParseResponse(response);
      if (response.ok) data = await waitForPaymentOperation(data);
      
      if (response.ok && data.success) {
        setPubClaimSuccess(`Revenue successfully claimed on Arc Testnet! TxHash: ${data.txHash}`);
        fetchPublishers(); // Refresh global data
      } else {
        setError(`Claim Failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setError(`Failed to claim revenue: ${err.message}`);
    } finally {
      setPubClaiming(false);
    }
  };

  const handleToggleAdminView = (showAdmin) => {
    setIsAdminView(showAdmin);
    if (!showAdmin) {
      setIsAdminAuthenticated(false);
      setAdminAuthError("");
    }
    if (showAdmin) {
      // Set hash - this is bulletproof and works on Vercel without 404 rewrite rules!
      window.location.hash = '/admin';
    } else {
      // Clear hash and return to path
      if (window.location.hash) {
        window.history.pushState("", document.title, window.location.pathname + window.location.search);
      }
      const currentPath = window.location.pathname;
      if (currentPath.endsWith('/admin') || currentPath.endsWith('/admin/')) {
        const basePath = currentPath.replace(/\/admin\/?$/, '');
        window.history.pushState({ admin: false }, '', basePath || '/');
      }
    }
  };

  const fetchAdminSurfAI = useCallback(async () => {
    if (!isAdminAuthenticated) return null;
    setSurfAIAdminPhase("loading");
    setSurfAIAdminStatus("");
    try {
      const response = await authFetch(`${BACKEND_URL}/api/admin/surfai`);
      const data = await safeParseResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not load SurfAI configuration.");
      const surfai = data.surfai || {};
      setSurfAIAdminDraft({
        title: surfai.title || INITIAL_SURFAI_ARTICLE.title,
        snippet: surfai.snippet || INITIAL_SURFAI_ARTICLE.snippet,
        content: surfai.content || "",
        price: surfai.price || INITIAL_SURFAI_ARTICLE.price,
        pdfUrl: surfai.pdfUrl || "",
        videoUrl: surfai.videoUrl || "",
      });
      setSurfAIAdminPhase("ready");
      return surfai;
    } catch (surfAIAdminError) {
      console.error("Failed to load SurfAI admin configuration:", surfAIAdminError);
      setSurfAIAdminPhase("error");
      setSurfAIAdminStatus(surfAIAdminError.message || "Could not load SurfAI configuration.");
      return null;
    }
  }, [authFetch, isAdminAuthenticated]);

  const handleSurfAIAdminChange = (field, value) => {
    setSurfAIAdminDraft((current) => ({ ...current, [field]: value }));
    if (surfAIAdminStatus) setSurfAIAdminStatus("");
  };

  const handleSurfAIAdminSubmit = async (event) => {
    event.preventDefault();
    if (surfAIAdminPhase === "saving") return;
    setSurfAIAdminPhase("saving");
    setSurfAIAdminStatus("Saving SurfAI edition to the protected ledger...");
    try {
      const response = await authFetch(`${BACKEND_URL}/api/admin/surfai`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(surfAIAdminDraft),
      });
      const data = await safeParseResponse(response);
      if (!response.ok) {
        const validationMessage = Array.isArray(data.details)
          ? data.details.map((detail) => `${detail.path}: ${detail.message}`).join(" · ")
          : data.error;
        throw new Error(validationMessage || "Could not save SurfAI configuration.");
      }
      const surfai = data.surfai;
      setSurfAIAdminDraft({
        title: surfai.title,
        snippet: surfai.snippet,
        content: surfai.content,
        price: surfai.price,
        pdfUrl: surfai.pdfUrl || "",
        videoUrl: surfai.videoUrl || "",
      });
      setSurfAIArticle((current) => ({ ...current, ...surfai }));
      setSurfAIAdminPhase("ready");
      setSurfAIAdminStatus("SurfAI content, PDF and video configuration saved successfully.");
      await Promise.all([fetchSurfAIMetadata(), fetchLibrary({ silent: true })]);
    } catch (surfAISaveError) {
      console.error("Failed to save SurfAI admin configuration:", surfAISaveError);
      setSurfAIAdminPhase("error");
      setSurfAIAdminStatus(surfAISaveError.message || "Could not save SurfAI configuration.");
    }
  };

  useEffect(() => {
    fetchArticles();
    fetchPublishers();
    fetchSurfAIMetadata();
  }, [fetchArticles, fetchPublishers, fetchSurfAIMetadata]);

  // Check if current IP is authorized admin when entering admin view
  useEffect(() => {
    if (isAdminView && !isAdminAuthenticated) {
      const checkAdminIp = async () => {
        try {
      const response = await authFetch(`${BACKEND_URL}/api/admin/session`);
          if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
              setIsAdminAuthenticated(true);
            }
          }
        } catch (err) {
          console.error("Failed to check admin IP authorization:", err);
        }
      };
      checkAdminIp();
    }
  }, [authFetch, authenticated, isAdminView, isAdminAuthenticated]);

  useEffect(() => {
    if (isAdminView && isAdminAuthenticated) fetchAdminSurfAI();
  }, [fetchAdminSurfAI, isAdminAuthenticated, isAdminView]);

  const handleToggleVerify = async (email, currentStatus) => {
    setAdminStatusMsg(`Updating verification for ${email}...`);
    try {
      const response = await authFetch(`${BACKEND_URL}/api/publishers/verify`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, verified: !currentStatus })
      });
      if (response.ok) {
        setAdminStatusMsg(`Successfully ${!currentStatus ? 'granted seal to' : 'revoked seal from'} ${email}!`);
        fetchPublishers();
        fetchArticles();
        setTimeout(() => setAdminStatusMsg(""), 3500);
      } else {
        const data = await response.json().catch(() => ({}));
        setAdminStatusMsg(data.error || "Failed to update verification status.");
      }
    } catch (err) {
      console.error("Failed to toggle verify publisher:", err);
      setAdminStatusMsg(`Error: ${err.message}`);
    }
  };

  const handleDeletePublisher = async (email) => {
    if (!confirm(`Are you sure you want to delete publisher ${email}?`)) return;
    setAdminStatusMsg(`Deleting publisher ${email}...`);
    try {
      const response = await authFetch(`${BACKEND_URL}/api/publishers?email=${encodeURIComponent(email)}`, {
        method: "DELETE"
      });
      if (response.ok) {
        setAdminStatusMsg(`Successfully deleted publisher ${email}!`);
        fetchPublishers();
        fetchArticles();
        setTimeout(() => setAdminStatusMsg(""), 3500);
      } else {
        const data = await response.json().catch(() => ({}));
        setAdminStatusMsg(data.error || "Failed to delete publisher.");
      }
    } catch (err) {
      console.error("Failed to delete publisher:", err);
      setAdminStatusMsg(`Error: ${err.message}`);
    }
  };

  const handleCreatePublisher = async (e) => {
    e.preventDefault();
    setAdminStatusMsg("Creating publisher...");
    
    if (adminWallet && !isValidEthAddress(adminWallet)) {
      setAdminStatusMsg("Error: Please enter a valid Ethereum address for the wallet.");
      return;
    }

    try {
      const response = await authFetch(`${BACKEND_URL}/api/publishers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: adminEmail,
          name: adminName,
          domain: adminDomain,
          walletAddress: adminWallet,
          category: adminCategory
        })
      });
      const data = await safeParseResponse(response);
      if (response.ok) {
        setAdminStatusMsg("Publisher created successfully!");
        setAdminEmail("");
        setAdminName("");
        setAdminDomain("");
        setAdminWallet("");
        fetchPublishers();
        fetchArticles(); // Refresh verification check marks
        setTimeout(() => setAdminStatusMsg(""), 3000);
      } else {
        setAdminStatusMsg(data.error || "Failed to create publisher.");
      }
    } catch (err) {
      console.error(err);
      setAdminStatusMsg("Server error.");
    }
  };


  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const walletModalRef = useRef(null);
  const readerHeadingRef = useRef(null);
  const articleListHeadingRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState("Click address to copy");
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetSuccess, setFaucetSuccess] = useState("");
  const [faucetError, setFaucetError] = useState("");

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
    setIsLibraryView(false);
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

  const handleCopyAddress = async (addr) => {
    if (!addr) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(addr);
      setCopyStatus("Copied Address!");
      setTimeout(() => setCopyStatus("Click address to copy"), 1500);
    } catch (err) {
      console.error("Failed to copy wallet address:", err);
      setCopyStatus("Copy failed — select the address manually");
      setTimeout(() => setCopyStatus("Click address to copy"), 3000);
    }
  };

  const handleSyncBalance = async () => {
    if (!authenticated || !user) return;
    if (!circleWallet) {
      setCopyStatus("Initializing wallet...");
      await fetchUserCircleWallet();
      return;
    }
    setCopyStatus("Syncing balance...");
    try {
      const response = await authFetch(`${BACKEND_URL}/api/user/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (response.ok) {
        setCircleWallet(prev => prev ? { ...prev, balance: data.balance, balanceSyncedAt: data.balanceSyncedAt || prev.balanceSyncedAt } : null);
        setUnlockedArticles(data.unlockedArticles || {});
        dispatchReaderLifecycle({
          type: 'WALLET_READY',
          degraded: data.walletStatus === 'DEGRADED',
          message: data.walletWarning || '',
          balanceSyncedAt: data.balanceSyncedAt || null,
        });
        dispatchReaderLifecycle({ type: 'HYDRATE_OPERATIONS', operations: data.pendingOperations || [] });
        setCopyStatus(data.walletStatus === 'DEGRADED' ? "Wallet loaded; balance is cached." : "Balance updated!");
        setTimeout(() => setCopyStatus("Click address to copy"), 1500);
      } else {
        setCopyStatus("Sync failed.");
        setTimeout(() => setCopyStatus("Click address to copy"), 1500);
      }
    } catch (err) {
      console.error(err);
      setCopyStatus(`Sync error: ${err.message || String(err)}`);
      setTimeout(() => setCopyStatus("Click address to copy"), 3000);
    }
  };

  const handleRequestFaucet = async () => {
    if (!authenticated || !user) return;
    
    setFaucetLoading(true);
    setFaucetSuccess("");
    setFaucetError("");
    setError(""); // Clear main error too
    setCopyStatus("Requesting faucet...");

    let activeWallet = circleWallet;
    if (!activeWallet) {
      setCopyStatus("Initializing wallet...");
      const result = await fetchUserCircleWallet();
      activeWallet = result?.wallet;
      if (!activeWallet) {
        setFaucetLoading(false);
        const actualError = result?.error || "Unknown initialization error";
        setFaucetError(`Init Failed: ${actualError}`);
        setError(`Init Failed: ${actualError}`);
        setCopyStatus("Wallet error.");
        return;
      }
    }
    
    try {
      const response = await authFetch(`${BACKEND_URL}/api/user/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      let data = await safeParseResponse(response);
      if (response.ok) {
        data = await waitForPaymentOperation(data);
        const walletResult = await fetchUserCircleWallet();
        if (walletResult?.wallet) setCircleWallet(walletResult.wallet);
        setFaucetSuccess(`Faucet complete! +${data.amount} USDC has been credited to your account.`);
        setCopyStatus("Faucet complete!");
        setTimeout(() => setCopyStatus("Click address to copy"), 2000);
      } else {
        setFaucetError(data.error || "Faucet claim failed.");
        setCopyStatus("Faucet failed.");
        setTimeout(() => setCopyStatus("Click address to copy"), 3000);
      }
    } catch (err) {
      console.error(err);
      if (err.paymentPending) {
        setFaucetSuccess(err.message);
        setCopyStatus("Faucet pending confirmation.");
      } else {
        setFaucetError(err.message || "Failed to contact faucet server.");
        setCopyStatus("Faucet failed.");
      }
      setTimeout(() => setCopyStatus("Click address to copy"), 3000);
    } finally {
      setFaucetLoading(false);
    }
  };

  const getUnlockedDetails = (artId) => {
    const val = unlockedArticles[artId];
    if (!val) return null;
    if (typeof val === 'object' && val !== null && typeof val.txHash === 'string' && val.txHash) {
      return { ...val, isMock: false };
    }
    if (typeof val === 'string' && val) {
      return {
        txHash: val,
        isMock: false
      };
    }
    // Older records may only contain a boolean unlock marker. The content is
    // still available, but there is no transaction hash that can be linked.
    return null;
  };

  const fetchLibrary = useCallback(async ({ silent = false } = {}) => {
    if (!authenticated || !user) {
      setLibrary({ items: [], pending: [], summary: { totalItems: 0, totalSpent: '0.00', currency: 'USDC' } });
      setLibraryPhase('idle');
      setLibraryError('');
      return null;
    }

    if (!silent) setLibraryPhase('loading');
    setLibraryError('');
    try {
      const response = await authFetch(`${BACKEND_URL}/api/user/library`);
      const data = await safeParseResponse(response);
      if (!response.ok) throw new Error(data.error || 'Could not load your library.');
      setLibrary({
        items: Array.isArray(data.items) ? data.items : [],
        pending: Array.isArray(data.pending) ? data.pending : [],
        summary: data.summary || { totalItems: 0, totalSpent: '0.00', currency: 'USDC' },
      });
      dispatchReaderLifecycle({ type: 'HYDRATE_OPERATIONS', operations: data.pending || [] });
      setLibraryPhase('ready');
      return data;
    } catch (libraryLoadError) {
      console.error('Could not load reader library:', libraryLoadError);
      setLibraryError(libraryLoadError.message || 'Could not load your library.');
      if (!silent) setLibraryPhase('error');
      return null;
    }
  }, [authenticated, authFetch, user]);

  // Fetch or create user's Circle Programmable Wallet on backend upon login
  const fetchUserCircleWallet = useCallback(() => {
    if (!authenticated || !user) {
      walletRequestGenerationRef.current += 1;
      walletRequestRef.current = null;
      setCircleWallet(null);
      setUnlockedArticles({});
      setIsLoadingWallet(false);
      dispatchReaderLifecycle({ type: 'RESET' });
      return Promise.resolve({ wallet: null, error: null });
    }

    const accountId = user.id;
    if (walletRequestRef.current?.accountId === accountId) {
      return walletRequestRef.current.promise;
    }

    const requestGeneration = walletRequestGenerationRef.current + 1;
    walletRequestGenerationRef.current = requestGeneration;
    setIsLoadingWallet(true);
    setError("");
    dispatchReaderLifecycle({ type: 'WALLET_LOADING' });

    const request = (async () => {
      try {
        const response = await authFetch(`${BACKEND_URL}/api/user/wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        const data = await safeParseResponse(response);
        if (response.ok) {
          const serverUnlockedArticles = data.unlockedArticles || {};
          const walletData = {
            address: data.address,
            balance: data.balance,
            walletId: data.walletId,
            isMock: data.isMock,
            balanceSyncedAt: data.balanceSyncedAt || null,
          };
          if (walletRequestGenerationRef.current === requestGeneration) {
            setCircleWallet(walletData);
            setUnlockedArticles(serverUnlockedArticles);
            dispatchReaderLifecycle({
              type: 'WALLET_READY',
              degraded: data.walletStatus === 'DEGRADED',
              message: data.walletWarning || '',
              balanceSyncedAt: data.balanceSyncedAt || null,
            });
            dispatchReaderLifecycle({ type: 'HYDRATE_OPERATIONS', operations: data.pendingOperations || [] });
          }

          const legacyReceipts = collectLegacyEntitlementReceipts({
            storage: window.localStorage,
            user,
            unlockedArticles: serverUnlockedArticles,
          });
          if (legacyReceipts.length) {
            void (async () => {
              try {
                const reconciliationResponse = await authFetch(`${BACKEND_URL}/api/user/entitlements/reconcile`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ receipts: legacyReceipts }),
                });
                const reconciliation = await safeParseResponse(reconciliationResponse);
                if (reconciliationResponse.ok && walletRequestGenerationRef.current === requestGeneration) {
                  setUnlockedArticles(reconciliation.unlockedArticles || serverUnlockedArticles);
                }
              } catch (reconciliationError) {
                console.error("Could not reconcile legacy article receipts:", reconciliationError);
              }
            })();
          }
          return { wallet: walletData, error: null };
        }

        const errorMsg = data.error || "Failed to load Circle MPC wallet.";
        if (walletRequestGenerationRef.current === requestGeneration) {
          setError(errorMsg);
          dispatchReaderLifecycle({ type: 'WALLET_ERROR', message: errorMsg });
        }
        return { wallet: null, error: errorMsg };
      } catch (err) {
        console.error("Error fetching Circle wallet:", err);
        const errorMsg = `Network/Proxy Error: ${err.message || String(err)}`;
        if (walletRequestGenerationRef.current === requestGeneration) {
          setError(errorMsg);
          dispatchReaderLifecycle({ type: 'WALLET_ERROR', message: errorMsg });
        }
        return { wallet: null, error: errorMsg };
      } finally {
        if (walletRequestGenerationRef.current === requestGeneration) {
          setIsLoadingWallet(false);
          walletRequestRef.current = null;
        }
      }
    })();

    walletRequestRef.current = { accountId, promise: request };
    return request;
  }, [authenticated, authFetch, user]);

  useEffect(() => {
    fetchUserCircleWallet();
  }, [fetchUserCircleWallet]);

  useEffect(() => {
    if (authenticated && user) fetchLibrary();
  }, [authenticated, fetchLibrary, user]);

  useEffect(() => {
    if (!authenticated || pendingPayments.length === 0) return undefined;
    let disposed = false;
    let polling = false;

    const refreshPendingPayments = async () => {
      if (polling || disposed || (document.visibilityState && document.visibilityState !== 'visible')) return;
      polling = true;
      let settled = false;
      try {
        for (const operation of pendingPayments) {
          const response = await authFetch(`${BACKEND_URL}/api/transactions/${operation.transactionId}`);
          const data = await safeParseResponse(response);
          if (disposed || !data.transactionId) continue;
          dispatchReaderLifecycle({ type: 'PAYMENT_UPDATE', operation: data });
          if (['COMPLETE', 'FAILED'].includes(data.status)) settled = true;
        }
        if (settled && !disposed) {
          await Promise.all([fetchUserCircleWallet(), fetchLibrary({ silent: true })]);
        }
      } catch (pendingRefreshError) {
        console.error('Could not refresh pending payments:', pendingRefreshError);
      } finally {
        polling = false;
      }
    };

    const timer = window.setInterval(refreshPendingPayments, 5000);
    void refreshPendingPayments();
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [authenticated, authFetch, fetchLibrary, fetchUserCircleWallet, pendingPayments]);

  useEffect(() => {
    const refreshAfterInterruption = () => {
      if (document.visibilityState && document.visibilityState !== "visible") return;
      fetchArticles();
      fetchPublishers();
      fetchSurfAIMetadata();
      if (authenticated) {
        fetchUserCircleWallet();
        fetchLibrary({ silent: true });
      }
    };

    window.addEventListener("online", refreshAfterInterruption);
    document.addEventListener("visibilitychange", refreshAfterInterruption);
    return () => {
      window.removeEventListener("online", refreshAfterInterruption);
      document.removeEventListener("visibilitychange", refreshAfterInterruption);
    };
  }, [authenticated, fetchArticles, fetchLibrary, fetchPublishers, fetchSurfAIMetadata, fetchUserCircleWallet]);

  useEffect(() => {
    if (showWalletModal) {
      setWithdrawAddress("");
      setWithdrawAmount("");
      setWithdrawError("");
      setWithdrawSuccess("");
      setFaucetSuccess("");
      setFaucetError("");
    }
  }, [showWalletModal]);

  useEffect(() => {
    if (!showWalletModal) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusModal = window.requestAnimationFrame(() => {
      walletModalRef.current?.querySelector("button")?.focus();
    });

    const handleModalKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowWalletModal(false);
        return;
      }

      if (event.key !== "Tab" || !walletModalRef.current) return;
      const focusable = Array.from(walletModalRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleModalKeyDown);
    return () => {
      window.cancelAnimationFrame(focusModal);
      document.removeEventListener("keydown", handleModalKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [showWalletModal]);

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    if (!withdrawAmount || !withdrawAddress) {
      setWithdrawError("Please enter both amount and destination address.");
      return;
    }

    if (!isValidEthAddress(withdrawAddress)) {
      setWithdrawError("Please enter a valid Ethereum destination address (0x...).");
      return;
    }
    
    const amountVal = parseFloat(withdrawAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setWithdrawError("Please enter a valid amount greater than 0.");
      return;
    }
    
    if (amountVal > parseFloat(circleWallet?.balance || "0")) {
      setWithdrawError("Withdraw amount exceeds current balance.");
      return;
    }

    setWithdrawLoading(true);
    setWithdrawError("");
    setWithdrawSuccess("");

    try {
      const response = await authFetch(`${BACKEND_URL}/api/user/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          destinationAddress: withdrawAddress,
          amount: withdrawAmount
        })
      });

      let data = await safeParseResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Withdrawal request failed.");
      }
      data = await waitForPaymentOperation(data);
      const walletResult = await fetchUserCircleWallet();
      if (walletResult?.wallet) setCircleWallet(walletResult.wallet);

      setWithdrawSuccess(`Success! Withdrew ${amountVal.toFixed(4)} USDC. TxHash: ${shortenAddress(data.txHash)}`);
      setWithdrawAmount("");
      
      // Fetch articles again to sync
      await fetchArticles();

    } catch (err) {
      console.error("Withdrawal failed:", err);
      if (err.paymentPending) {
        setWithdrawSuccess(err.message);
      } else {
        setWithdrawError(err.message || "Failed to execute withdrawal.");
      }
    } finally {
      setWithdrawLoading(false);
    }
  };

  const shortenAddress = (addr) => {
    if (!addr) return "";
    return addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
  };

  const handleSelectArticle = (art) => {
    setIsLibraryView(false);
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
    
    // Reset PDF simulation
    setPdfSimulating(false);
    setPdfReady(false);
    setPdfSimStep(0);
    
    // Reset Video simulation
    setShowSurfVideoMockup(false);
    setVideoSimulating(false);
    setVideoReady(false);
    setVideoSimStep(0);
    window.setTimeout(() => {
      if (window.matchMedia("(max-width: 768px)").matches) {
        readerHeadingRef.current?.focus();
      }
    }, 0);
  };

  const handleReturnToArticleList = () => {
    setSelectedArticle(null);
    window.setTimeout(() => articleListHeadingRef.current?.focus(), 0);
  };

  const handleOpenLibrary = () => {
    setSelectedArticle(null);
    setShowApplyForm(false);
    setIsAdminView(false);
    setIsPublisherView(false);
    setIsLibraryView(true);
    void fetchLibrary();
  };

  const handleOpenLibraryItem = (item) => {
    const article = articles.find((entry) => entry.id === item.articleId) || {
      id: item.articleId,
      title: item.title,
      author: item.author,
      snippet: item.snippet,
      price: item.price || item.amount,
      verified: true,
    };
    setIsLibraryView(false);
    handleSelectArticle(article);
  };

  const triggerScrapeSimulation = () => {
    if (isScraping || !selectedArticle) return;
    const articleIdAtStart = selectedArticle.id;
    setIsScraping(true);
    setScrapeStep(1); // query
    setScrapeWords(0);
    setScrapeCost(0);
    setScrapeResult("");

    const costPerRead = parseFloat(selectedArticle?.price || "0.0001");

    // Step 1: Query article info (2s)
    setTimeout(() => {
      setSelectedArticle(current => {
        if (!current || current.id !== articleIdAtStart) return current;
        setScrapeStep(2); // payment processing
        
        // Step 2: Pay on-chain micropayment tariff (3s)
        setTimeout(() => {
          setSelectedArticle(current2 => {
            if (!current2 || current2.id !== articleIdAtStart) return current2;
            setScrapeStep(3); // scraping / word count counting up
            
            // Simulating the word count scraper (4s)
            let count = 0;
            const totalWords = 84; // Mock word length of the premium column
            const interval = setInterval(() => {
              setSelectedArticle(current3 => {
                if (!current3 || current3.id !== articleIdAtStart) {
                  clearInterval(interval);
                  return current3;
                }
                count += 7;
                if (count >= totalWords) {
                  clearInterval(interval);
                  setScrapeWords(totalWords);
                  setScrapeCost(costPerRead);
                  
                  // Step 4: Finished scraping, displaying the synthesized analysis summary (1.5s)
                  setTimeout(() => {
                    setSelectedArticle(current4 => {
                      if (!current4 || current4.id !== articleIdAtStart) return current4;
                      setScrapeStep(4); // done
                      setScrapeResult(
                        `[AI ANALYTICAL REPORT] "${current4.title || "Dispatch"}" reveals a revolutionary shift from traditional subscription-bundled payment models to programmatic API-driven micropayment channels. Equipped with Circle MPC Wallets, autonomous LLM agents buy web infrastructure, GPU computing, and premium information directly. Settle total of ${costPerRead} USDC was successfully processed on-chain.`
                      );
                      return current4;
                    });
                  }, 1000);
                } else {
                  setScrapeWords(count);
                  // Increment cost proportionally to cawed words
                  setScrapeCost((count / totalWords) * costPerRead);
                }
                return current3;
              });
            }, 300);
            
            return current2;
          });
        }, 3000);
        
        return current;
      });
    }, 2000);
  };

  const getDailyAISurfArticle = () => {
    return surfAIArticle;
  };

  const triggerPdfSimulation = () => {
    if (pdfSimulating) return;
    setPdfSimulating(true);
    setPdfReady(false);
    setPdfSimStep(1);

    setTimeout(() => {
      setPdfSimStep(2);
      setTimeout(() => {
        setPdfSimStep(3);
        setTimeout(() => {
          setPdfSimStep(4);
          setTimeout(() => {
            setPdfSimulating(false);
            setPdfReady(true);
          }, 800);
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const triggerVideoSimulation = () => {
    if (videoSimulating) return;
    setVideoSimulating(true);
    setVideoReady(false);
    setVideoSimStep(1);
    
    setTimeout(() => {
      setVideoSimStep(2);
      setTimeout(() => {
        setVideoSimStep(3);
        setTimeout(() => {
          setVideoSimulating(false);
          setVideoReady(true);
        }, 800);
      }, 1000);
    }, 1000);
  };

  const openSurfDailyDispatch = () => {
    handleSelectArticle(getDailyAISurfArticle());
    setShowApplyForm(false);
    setIsPublisherView(false);
    handleToggleAdminView(false);
  };

  const openSurfVideoStudio = (videoUrl) => {
    setSurfVideoUrl(videoUrl);
    setSurfRequestedAsset("");
    setSelectedArticle(null);
    setShowApplyForm(false);
    setIsPublisherView(false);
    handleToggleAdminView(false);
    setShowSurfVideoMockup(true);
    triggerVideoSimulation();
  };

  const handleSurfLogoClick = async () => {
    const surfArticleId = "surfai-daily";
    if (!authenticated || !unlockedArticles[surfArticleId]) {
      openSurfDailyDispatch();
      setSurfRequestedAsset("video");
      setError("");
      return;
    }

    const protectedFields = await fetchFullArticleContent(surfArticleId);
    if (!protectedFields?.videoUrl) {
      openSurfDailyDispatch();
      setError("The protected SurfAI video is not available. Please try again shortly.");
      return;
    }

    openSurfVideoStudio(protectedFields.videoUrl);
  };

  const handleUnlockOnChain = async () => {
    if (isUnlocking) return;
    const unlockingArticleId = selectedArticle?.id;
    if (!unlockingArticleId) return;
    setIsUnlocking(true);
    setError("");
    setTxStatus("");
    setTxHash("");

    if (!authenticated) {
      openLogin();
      setIsUnlocking(false);
      return;
    }

    if (!circleWallet) {
      setError("Circle wallet is not ready. Please try logging in again.");
      setIsUnlocking(false);
      return;
    }

    setTxStatus("Authorizing pay-per-read micropayment via Circle W3S...");

    try {
      const response = await authFetch(`${BACKEND_URL}/api/articles/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          articleId: unlockingArticleId
        })
      });
      
      let data = await safeParseResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Micropayment failed.");
      }
      data = await waitForPaymentOperation(data);

      console.log("[PaperCut React] Micropayment transfer successful:", data.txHash);
      setTxHash(data.txHash);
      setTxStatus("Payment settled successfully!");

      // Update local wallet balance state
      const walletResult = await fetchUserCircleWallet();
      if (walletResult?.wallet) setCircleWallet(walletResult.wallet);
      await fetchLibrary({ silent: true });

      // Save unlocked state
      setUnlockedArticles((currentUnlocked) => ({
        ...currentUnlocked,
        [unlockingArticleId]: {
          txHash: data.txHash || data.transactionId,
          isMock: !!data.isMock
        }
      }));

      if (unlockingArticleId === "surfai-daily" && surfRequestedAsset === "video") {
        const protectedFields = await fetchFullArticleContent(unlockingArticleId);
        if (protectedFields?.videoUrl) {
          openSurfVideoStudio(protectedFields.videoUrl);
        } else {
          setError("Payment succeeded, but the protected video is not available yet. Please try Video brief again.");
        }
      }
      
      setTimeout(() => {
        setTxStatus("");
        setTxHash("");
      }, 2000);

    } catch (err) {
      console.error("Micropayment error:", err);
      if (err.paymentPending) {
        setTxStatus(err.message);
        await fetchLibrary({ silent: true });
      } else {
        setTxStatus("");
        setError(err.message || "Transaction failed. Do you have enough USDC balance?");
      }
    } finally {
      setIsUnlocking(false);
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
          <button
            type="button"
            className="nav-front-page-btn" 
            onClick={() => {
              setSelectedArticle(null);
              setShowApplyForm(false);
              handleToggleAdminView(false);
              setIsPublisherView(false);
              setIsLibraryView(false);
            }}
            title="Return to Front Page / Home"
            style={{ flex: 1, textAlign: 'left' }}
          >
            {isAdminView || isPublisherView ? "← READER VIEW" : "FRONT PAGE"}
          </button>
          <div className="nav-datetime mono-text" style={{ flex: 1, textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-grey)' }}>
            {formatDateTime(currentDate)}
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            {isAdminView && (
              <button
                type="button"
                className={`nav-front-page-btn`}
                onClick={() => {
                  setSelectedArticle(null);
                  setShowApplyForm(false);
                  handleToggleAdminView(false);
                }}
                style={{ marginRight: '16px', color: 'var(--ink-red)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}
                title="Close Admin Portal"
              >
                [CLOSE ADMIN]
              </button>
            )}
            {!isAdminView && !isPublisherView && (
              <button
                type="button"
                className={`nav-front-page-btn`}
                onClick={() => {
                  setSelectedArticle(null);
                  setShowApplyForm(false);
                  setIsLibraryView(false);
                  setIsPublisherView(true);
                  window.location.hash = '/publisher';
                }}
                style={{ marginRight: '16px', color: 'var(--ink-red)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}
                title="Open Publisher Portal"
              >
                [PUBLISHER PORTAL]
              </button>
            )}
            {isPublisherView && (
              <button
                type="button"
                className={`nav-front-page-btn`}
                onClick={() => {
                  setIsPublisherView(false);
                  if (window.location.hash) {
                    window.history.pushState("", document.title, window.location.pathname + window.location.search);
                  }
                }}
                style={{ marginRight: '16px', color: 'var(--ink-red)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}
                title="Close Publisher Portal"
              >
                [CLOSE PORTAL]
              </button>
            )}
            {!authenticated ? (
              <button
                type="button"
                className="nav-front-page-btn" 
                onClick={openLogin}
                aria-haspopup="dialog"
                title={authPhase === 'initializing' ? 'Authentication is initializing; you can still open the sign-in panel.' : 'Sign in'}
              >
                {authPhase === 'initializing' ? 'SIGN IN · INITIALIZING' : 'SIGN IN'}
              </button>
            ) : (
              <div className="wallet-info-group">
                <button
                  type="button"
                  className={`nav-front-page-btn library-nav-button ${isLibraryView ? 'is-active' : ''}`}
                  onClick={handleOpenLibrary}
                  title="Open your purchased dispatches"
                >
                  MY LIBRARY
                  {library.summary.totalItems > 0 && <span className="library-nav-count">{library.summary.totalItems}</span>}
                </button>
                <button 
                  type="button"
                  className={`btn-wallet-icon wallet-phase-${readerLifecycle.walletPhase}`}
                  onClick={() => setShowWalletModal(true)} 
                  title={readerLifecycle.walletMessage || `Open Ledger Vault Wallet (${smartWalletAddress || user?.wallet?.address || 'initializing'})`}
                >
                  <svg width="18" height="16" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                    <path d="M17 4H3C1.89543 4 1 4.89543 1 6V15C1 16.1046 1.89543 17 3 17H17C18.1046 17 19 16.1046 19 15V6C19 4.89543 18.1046 4 17 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19 8H14.5C13.6716 8 13 8.67157 13 9.5C13 10.3284 13.6716 11 14.5 11H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 8.5C1 4.5 4.5 1 9.5 1H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="wallet-phase-dot" aria-label={`Wallet ${readerLifecycle.walletPhase}`}></span>
                </button>
                <button className="btn btn-sm btn-secondary" onClick={logout} style={{ marginLeft: '12px' }}>Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </nav>
            {/* MAIN CONTAINER */}
      {isLibraryView ? (
        <main className="library-page">
          <header className="library-header">
            <div>
              <span className="library-kicker">PRIVATE READING ROOM</span>
              <h1>My Library</h1>
              <p>Your permanent PaperCut purchases and payments awaiting confirmation.</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => fetchLibrary()} disabled={libraryPhase === 'loading'}>
              {libraryPhase === 'loading' ? 'SYNCING…' : 'SYNC LIBRARY'}
            </button>
          </header>

          <section className="reader-status-strip" aria-label="Reader account status">
            <div className={`reader-status-step is-${authPhase}`}>
              <span>01</span><strong>Identity</strong><small>{authPhase === 'authenticated' ? 'Signed in' : 'Initializing'}</small>
            </div>
            <div className={`reader-status-step is-${readerLifecycle.walletPhase}`}>
              <span>02</span><strong>Wallet</strong><small>{readerLifecycle.walletPhase === WALLET_PHASE.DEGRADED ? 'Cached balance' : readerLifecycle.walletPhase}</small>
            </div>
            <div className={`reader-status-step ${pendingPayments.length ? 'is-pending' : 'is-ready'}`}>
              <span>03</span><strong>Payments</strong><small>{pendingPayments.length ? `${pendingPayments.length} confirming` : 'Up to date'}</small>
            </div>
          </section>

          {readerLifecycle.walletMessage && (
            <div className="library-notice" role="status">{readerLifecycle.walletMessage} Your purchases remain available.</div>
          )}
          {libraryError && (
            <div className="library-notice is-error" role="alert">{libraryError}</div>
          )}

          <section className="library-summary" aria-label="Library summary">
            <div><strong>{library.summary.totalItems}</strong><span>Unlocked dispatches</span></div>
            <div><strong>{library.summary.totalSpent}</strong><span>{library.summary.currency} recorded</span></div>
            <div><strong>{library.pending.length || pendingPayments.length}</strong><span>Payments confirming</span></div>
          </section>

          {(library.pending.length > 0 || pendingPayments.length > 0) && (
            <section className="library-pending-section">
              <div className="library-section-heading">
                <span>SETTLEMENT DESK</span>
                <h2>Awaiting confirmation</h2>
              </div>
              <div className="library-pending-list">
                {(library.pending.length ? library.pending : pendingPayments).map((operation) => (
                  <div className="library-pending-item" key={operation.transactionId}>
                    <span className="library-pulse" aria-hidden="true"></span>
                    <div><strong>{operation.title || 'PaperCut transaction'}</strong><small>Circle status: {operation.circleState || operation.status}</small></div>
                    <span>{operation.amount} USDC</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="library-collection">
            <div className="library-section-heading">
              <span>OWNED EDITIONS</span>
              <h2>Purchased dispatches</h2>
            </div>
            {libraryPhase === 'loading' && library.items.length === 0 ? (
              <div className="library-empty">Checking the entitlement ledger…</div>
            ) : library.items.length === 0 ? (
              <div className="library-empty">
                <strong>Your reading room is ready.</strong>
                <p>Unlock a dispatch and it will appear here automatically on every signed-in device.</p>
                <button type="button" className="btn" onClick={() => setIsLibraryView(false)}>BROWSE FRONT PAGE</button>
              </div>
            ) : (
              <div className="library-grid">
                {library.items.map((item, index) => (
                  <article className="library-card" key={item.articleId}>
                    <div className="library-card-number">NO. {String(index + 1).padStart(2, '0')}</div>
                    <h3>{item.title}</h3>
                    <p className="library-card-author">By {item.author}</p>
                    <p>{item.snippet}</p>
                    <dl>
                      <div><dt>Purchased</dt><dd>{item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString() : 'Legacy record'}</dd></div>
                      <div><dt>Price</dt><dd>{item.amount} USDC</dd></div>
                    </dl>
                    <div className="library-card-actions">
                      <button type="button" className="btn" onClick={() => handleOpenLibraryItem(item)}>OPEN DISPATCH</button>
                      {item.txHash && (
                        <a href={getExplorerUrl(chainId, item.txHash)} target="_blank" rel="noreferrer">VIEW RECEIPT ↗</a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      ) : isPublisherView ? (
        <div className="portal-scroll-container" style={{ flex: '1', overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column' }}>
          {!authenticated ? (
          <main className="publisher-container" style={{ padding: '32px', maxWidth: '480px', margin: '80px auto', border: '2px solid var(--ink-black)', backgroundColor: 'var(--paper-accent)', boxShadow: '6px 6px 0 var(--ink-black)', textAlign: 'center' }}>
            <div className="greek-key"></div>
            <h2 className="serif-title font-italic" style={{ color: 'var(--ink-red)', fontSize: '24px', marginBottom: '8px' }}>PUBLISHER IDENTITY CHECK</h2>
            <p className="mono-text text-muted" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '24px' }}>
              Reader Signature Verification Required
            </p>
            <p className="serif-body" style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '24px', color: 'var(--ink-grey)' }}>
              Please sign the guest register with your cryptographic wallet. Once logged in, we will verify if your account is accredited with writing credentials.
            </p>
            <button className="btn" onClick={openLogin} style={{ padding: '10px 24px', fontSize: '12px', width: '100%' }}>
              SIGN GUEST REGISTER
            </button>
          </main>
        ) : !getPublisherRecord(user?.email?.address || "") ? (
          <main className="publisher-container" style={{ padding: '32px', maxWidth: '600px', margin: '40px auto', border: '2px solid var(--ink-black)', backgroundColor: 'var(--paper-accent)', boxShadow: '6px 6px 0 var(--ink-black)' }}>
            <div className="greek-key"></div>
            <h2 className="serif-title font-italic" style={{ color: 'var(--ink-red)', fontSize: '28px', marginBottom: '8px', textAlign: 'center' }}>Accreditation Application</h2>
            <p className="mono-text text-muted" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '24px', textAlign: 'center' }}>
              Apply for Author Induction & Verification Seal
            </p>
            <p className="serif-body" style={{ fontSize: '13px', lineHeight: '1.5', marginBottom: '20px', color: 'var(--ink-grey)' }}>
              Your account <strong>{user?.email?.address || user?.id}</strong> is not registered as an accredited publisher. Please complete the application below. This will link your credentials directly to the Admin Board for approval.
            </p>
            <form onSubmit={handleApplyPublisherSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>1. PUBLISHER PSEUDONYM / LEGAL NAME</label>
                <input 
                  type="text" 
                  required 
                  value={pubFormName}
                  onChange={(e) => setPubFormName(e.target.value)}
                  placeholder="e.g. Satoshi Nakamoto" 
                  style={{ padding: '10px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-serif)', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>2. REGISTRATION EMAIL</label>
                <input 
                  type="email" 
                  disabled
                  value={user?.email?.address || ""} 
                  style={{ padding: '10px', border: '1px solid var(--ink-light-grey)', background: 'var(--paper-bg-darker)', fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--ink-grey)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>3. VERIFIED DOMAIN</label>
                <input 
                  type="text" 
                  required 
                  value={pubFormDomain}
                  onChange={(e) => setPubFormDomain(e.target.value)}
                  placeholder="e.g. bitcoin.org" 
                  style={{ padding: '10px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-serif)', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>4. RECIPIENT WALLET ADDRESS (EVM)</label>
                <input 
                  type="text" 
                  disabled
                  value={pubFormWallet || "Awaiting wallet synchronization..."}
                  style={{ padding: '10px', border: '1px solid var(--ink-light-grey)', background: 'var(--paper-bg-darker)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-grey)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>5. EDITORIAL CATEGORY</label>
                <select 
                  value={pubFormCategory}
                  onChange={(e) => setPubFormCategory(e.target.value)}
                  style={{ padding: '10px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-serif)', fontSize: '13px' }}
                >
                  <option>Web3 Infrastructures & Protocols</option>
                  <option>AI-Agent Autonomous Economics</option>
                  <option>Decentralized High-Performance Compute</option>
                  <option>On-Chain Micropayments & L2 Scaling</option>
                </select>
              </div>
              <button type="submit" className="btn" style={{ padding: '12px 0', marginTop: '8px', letterSpacing: '0.06em', fontSize: '12px' }}>
                SUBMIT ACCREDITATION APPLICATION
              </button>
            </form>
            {pubFormStatusMsg && (
              <div className="mono-text" style={{ marginTop: '16px', fontSize: '11px', color: 'var(--ink-red)', textAlign: 'center', border: '1px dashed var(--ink-red)', padding: '8px', background: 'rgba(186,45,45,0.03)' }}>
                {pubFormStatusMsg}
              </div>
            )}
          </main>
        ) : !getPublisherRecord(user?.email?.address || "").verified ? (
          <main className="publisher-container" style={{ padding: '40px 32px', maxWidth: '500px', margin: '80px auto', border: '2px solid var(--ink-black)', backgroundColor: 'var(--paper-accent)', boxShadow: '6px 6px 0 var(--ink-black)', textAlign: 'center' }}>
            <div className="greek-key"></div>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉</div>
            <h2 className="serif-title font-italic" style={{ color: 'var(--ink-red)', fontSize: '24px', marginBottom: '12px' }}>APPLICATION PENDING</h2>
            <p className="serif-body" style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
              Dear <strong>{getPublisherRecord(user?.email?.address || "")?.name}</strong>,<br/>
              Your application with domain <code>{getPublisherRecord(user?.email?.address || "")?.domain}</code> has been linked directly to the Admin Board. 
            </p>
            <div className="mono-text" style={{ fontSize: '11px', border: '1px dashed var(--ink-red)', padding: '12px', background: 'rgba(186,45,45,0.03)', color: 'var(--ink-red)', marginBottom: '24px' }}>
              STATUS: AWAITING ADMIN ACCREDITATION APPROVAL
            </div>
            <p className="mono-text text-muted" style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--ink-grey)' }}>
              Once the admin grants the seal, this page will unlock your ledger dashboard.
            </p>
          </main>
        ) : (
          <main className="publisher-container" style={{ padding: '32px', maxWidth: '1200px', width: '95%', margin: '40px auto', border: '2px solid var(--ink-black)', backgroundColor: 'var(--paper-bg)', boxShadow: '6px 6px 0 var(--ink-black)', transition: 'max-width 0.3s ease' }}>
            <div className="greek-key"></div>
            
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--ink-black)', paddingBottom: '12px', marginBottom: '20px' }}>
              <div>
                <h2 className="serif-title font-italic" style={{ color: 'var(--ink-black)', fontSize: '32px', margin: 0 }}>Publisher Portal</h2>
                <p className="mono-text text-muted" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 0 0' }}>
                  Accredited Author Workspace
                </p>
              </div>
              <span className="rubber-stamp stamp-green" style={{ transform: 'rotate(2deg)' }}>✔ ACCREDITED</span>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid var(--ink-black)' }}>
              <button 
                onClick={() => setPublisherTab("ledger")} 
                style={{
                  padding: '8px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  border: 'none',
                  borderBottom: publisherTab === "ledger" ? '3px solid var(--ink-red)' : '3px solid transparent',
                  background: 'none',
                  color: publisherTab === "ledger" ? 'var(--ink-black)' : 'var(--ink-grey)',
                  fontWeight: 'bold',
                  outline: 'none'
                }}
              >
                LEDGER & REVENUE
              </button>
              <button 
                onClick={() => setPublisherTab("write")} 
                style={{
                  padding: '8px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  border: 'none',
                  borderBottom: publisherTab === "write" ? '3px solid var(--ink-red)' : '3px solid transparent',
                  background: 'none',
                  color: publisherTab === "write" ? 'var(--ink-black)' : 'var(--ink-grey)',
                  fontWeight: 'bold',
                  outline: 'none'
                }}
              >
                ✎ WRITE DISPATCH
              </button>
              <button 
                onClick={() => setPublisherTab("dispatches")} 
                style={{
                  padding: '8px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  border: 'none',
                  borderBottom: publisherTab === "dispatches" ? '3px solid var(--ink-red)' : '3px solid transparent',
                  background: 'none',
                  color: publisherTab === "dispatches" ? 'var(--ink-black)' : 'var(--ink-grey)',
                  fontWeight: 'bold',
                  outline: 'none'
                }}
              >
                📂 MY DISPATCHES
              </button>
            </div>

            {publisherTab === "ledger" ? (
              <>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px' }}>
                  <div style={{ flex: '1 1 300px', border: '1px solid var(--ink-black)', padding: '16px', background: 'var(--paper-accent)' }}>
                    <div className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-grey)', marginBottom: '12px' }}>AUTHOR PROFILE</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 'bold', color: 'var(--ink-black)' }}>{getPublisherRecord(user?.email?.address || "")?.name}</div>
                    <div className="mono-text" style={{ fontSize: '11px', color: 'var(--ink-grey)', margin: '4px 0' }}>Beat: {getPublisherRecord(user?.email?.address || "")?.category}</div>
                    <div className="mono-text" style={{ fontSize: '11px', color: 'var(--ink-red)' }}>Domain: {getPublisherRecord(user?.email?.address || "")?.domain}</div>
                  </div>

                  <div style={{ flex: '1 1 300px', border: '1px solid var(--ink-black)', padding: '16px', background: 'var(--paper-bg)' }}>
                    <div className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-grey)', marginBottom: '8px' }}>REVENUE BALANCE</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="mono-text" style={{ fontSize: '11px', color: 'var(--ink-grey)' }}>Total Earned:</span>
                      <span className="mono-text" style={{ fontSize: '12px', fontWeight: 'bold' }}>{pubEarnings.toFixed(4)} USDC</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="mono-text" style={{ fontSize: '11px', color: 'var(--ink-grey)' }}>Total Claimed:</span>
                      <span className="mono-text" style={{ fontSize: '12px', color: 'var(--ink-grey)' }}>{pubClaimed.toFixed(4)} USDC</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--ink-light-grey)', margin: '8px 0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="mono-text" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--ink-black)' }}>Available to Claim:</span>
                      <span className="mono-text" style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ink-red)' }}>{(pubEarnings - pubClaimed).toFixed(4)} USDC</span>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <button 
                    className="btn" 
                    disabled={pubEarnings - pubClaimed <= 0 || pubClaiming} 
                    onClick={handlePublisherClaim} 
                    style={{ padding: '12px 32px', fontSize: '13px', width: '100%', letterSpacing: '0.05em' }}
                  >
                    {pubClaiming ? "EXECUTING SECURE CLAIM..." : pubEarnings - pubClaimed <= 0 ? "NO REVENUE AVAILABLE TO CLAIM" : "CLAIM REVENUE ON-CHAIN"}
                  </button>
                  {pubClaimSuccess && (
                    <div className="mono-text" style={{ marginTop: '16px', fontSize: '11px', color: 'green', border: '1px dashed green', padding: '10px', background: 'rgba(0,128,0,0.03)', textAlign: 'left', lineHeight: '1.4' }}>
                      {pubClaimSuccess}
                    </div>
                  )}

                  {getPublisherRecord(user?.email?.address || "")?.claimHistory?.length > 0 && (
                    <div style={{ marginTop: '20px', borderTop: '1px solid var(--ink-light-grey)', paddingTop: '16px' }}>
                      <div className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-grey)', marginBottom: '8px', textTransform: 'uppercase' }}>Recent Claims History</div>
                      <div style={{ border: '1px solid var(--ink-light-grey)', maxHeight: '150px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '10px', fontFamily: 'var(--font-mono)', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-bg)', borderBottom: '1px solid var(--ink-light-grey)' }}>
                            <tr>
                              <th style={{ padding: '6px' }}>TIME</th>
                              <th style={{ padding: '6px' }}>AMOUNT</th>
                              <th style={{ padding: '6px' }}>TX HASH</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getPublisherRecord(user?.email?.address || "").claimHistory.map((claim, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--ink-light-grey)' }}>
                                <td style={{ padding: '6px' }}>{new Date(claim.timestamp).toLocaleString()}</td>
                                <td style={{ padding: '6px', color: 'green' }}>+{claim.amount} USDC</td>
                                <td style={{ padding: '6px' }}>
                                  <a href={`https://testnet.arcscan.app/tx/${claim.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-blue)', textDecoration: 'underline' }}>
                                    {claim.txHash.length > 30 ? claim.txHash.substring(0, 16) + "..." : claim.txHash}
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--ink-black)', paddingTop: '16px' }}>
                  <div className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-grey)', marginBottom: '12px', textTransform: 'uppercase' }}>Induction & Payout Registry Information</div>
                  <table style={{ width: '100%', fontSize: '12px', fontFamily: 'var(--font-serif)', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--ink-light-grey)' }}>
                        <td style={{ padding: '6px 0', color: 'var(--ink-grey)' }}>Induction Wallet Address</td>
                        <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'var(--font-mono)' }} title={getPublisherRecord(user?.email?.address || "")?.walletAddress}>
                          {getPublisherRecord(user?.email?.address || "")?.walletAddress}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--ink-light-grey)' }}>
                        <td style={{ padding: '6px 0', color: 'var(--ink-grey)' }}>EIP-3009 Gas-Free Claiming</td>
                        <td style={{ padding: '6px 0', textAlign: 'right', color: 'var(--ink-red)', fontFamily: 'var(--font-mono)' }}>SUPPORTED</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 0', color: 'var(--ink-grey)' }}>Settlement Blockchain</td>
                        <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>ARC TESTNET</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : publisherTab === "write" ? (
              <div className="dispatch-writer-container">
                <form onSubmit={handlePublishArticleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="writer-field-group">
                    <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>1. DISPATCH TITLE</label>
                    <input 
                      type="text" 
                      required 
                      value={newArticleTitle}
                      onChange={(e) => setNewArticleTitle(e.target.value)}
                      placeholder="e.g. Decentralized Governance in Autonomous Agent Networks" 
                      className="writer-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="writer-field-group">
                      <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>2. READ TARIFF (USDC)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0.01" 
                        max="10.00"
                        required 
                        value={newArticlePrice}
                        onChange={(e) => setNewArticlePrice(e.target.value)}
                        className="writer-input"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                    <div className="writer-field-group">
                      <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>3. RECIPIENT WALLET (LOCKED)</label>
                      <input 
                        type="text" 
                        disabled
                        value={getPublisherRecord(user?.email?.address || "")?.walletAddress || ""}
                        className="writer-input"
                        style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--paper-bg-darker)', color: 'var(--ink-grey)', border: '1px solid var(--ink-light-grey)' }}
                      />
                    </div>
                  </div>

                  <div className="writer-field-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>4. CONTENT (MARKDOWN & DRAG-PASTE SUPPORTED)</label>
                      <span className="mono-text" style={{ fontSize: '9px', color: 'var(--ink-grey)' }}>Drag-and-drop a .md file or paste content directly</span>
                    </div>

                    {/* Editor & Preview layout */}
                    <div className="editor-layout">
                      <div className="editor-pane-container">
                        {/* Formatting Toolbar */}
                        <div className="format-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <button type="button" className="btn-format" onClick={() => insertMarkdown("h1")}>H1</button>
                            <button type="button" className="btn-format" onClick={() => insertMarkdown("h2")}>H2</button>
                            <button type="button" className="btn-format" onClick={() => insertMarkdown("h3")}>H3</button>
                            <button type="button" className="btn-format" onClick={() => insertMarkdown("bold")}>B</button>
                            <button type="button" className="btn-format" onClick={() => insertMarkdown("italic")}>I</button>
                            <button type="button" className="btn-format" onClick={() => insertMarkdown("code")}>&lt;&gt;</button>
                            <button type="button" className="btn-format" onClick={() => insertMarkdown("codeblock")}>BLOCKCODE</button>
                            <button type="button" className="btn-format" onClick={() => insertMarkdown("link")}>LINK</button>
                            <button type="button" className="btn-format" onClick={() => insertMarkdown("quote")}>QUOTE</button>
                            <button type="button" className="btn-format" onClick={() => insertMarkdown("list")}>LIST</button>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <label htmlFor="markdown-file-import" className="btn-format" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}>
                              📥 IMPORT MD
                            </label>
                            <input 
                              type="file" 
                              id="markdown-file-import" 
                              accept=".md,.txt" 
                              onChange={handleImportMarkdown} 
                              style={{ display: 'none' }} 
                            />
                            <button type="button" className="btn-format btn-format-danger" onClick={handleClearDraft} style={{ border: '1px solid var(--ink-red)', color: 'var(--ink-red)' }}>
                              🗑 CLEAR
                            </button>
                          </div>
                        </div>

                        <textarea
                          id="dispatch-editor-textarea"
                          required
                          value={newArticleContent}
                          onChange={(e) => setNewArticleContent(e.target.value)}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onScroll={handleEditorScroll}
                          placeholder="Write or paste your markdown content here... Drag and drop a .md file directly to import it."
                          className="writer-textarea"
                        />
                      </div>
                      
                      <div className="preview-pane">
                        <div className="preview-pane-title">LIVE PREVIEW (16:9 RENDER)</div>
                        <div 
                          className="content-text markdown-render" 
                          style={{ height: 'calc(100% - 24px)', overflowY: 'auto', textJustify: 'auto', columnCount: '1' }}
                          dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(newArticleContent) || "<p style='color: var(--ink-grey); font-style: italic;'>No content written yet. Start typing or paste Markdown to see layout preview.</p>" }}
                        />
                      </div>
                    </div>

                    {/* Word Count & AutoSave Status Bar */}
                    <div className="editor-status-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '8px 12px', border: '1px solid var(--ink-black)', backgroundColor: 'var(--paper-accent)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <span><strong>WORDS:</strong> {getWordCount(newArticleContent)}</span>
                        <span><strong>CHARACTERS:</strong> {newArticleContent.length}</span>
                        <span><strong>EST. READ TIME:</strong> ~{Math.ceil(getWordCount(newArticleContent) / 200) || 1} MIN</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="save-status-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }}></span>
                        <span style={{ color: 'var(--ink-black)', fontWeight: 'bold' }}>DRAFT SYNCED</span>
                      </div>
                    </div>
                  </div>

                  {/* Markdown Reference Drawer */}
                  <div style={{ border: '1px solid var(--ink-black)', background: 'var(--paper-bg-darker)' }}>
                    <button 
                      type="button" 
                      onClick={() => setShowMdGuide(!showMdGuide)}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        background: 'var(--paper-bg-darker)',
                        color: 'var(--ink-black)',
                        border: 'none',
                        borderBottom: showMdGuide ? '1px solid var(--ink-black)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>📖 MARKDOWN FORMATTING QUICK REFERENCE</span>
                      <span>{showMdGuide ? "▲ COLLAPSE Guide" : "▼ EXPAND Guide"}</span>
                    </button>
                    {showMdGuide && (
                      <div style={{ padding: '16px', background: 'var(--paper-bg)', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--ink-black)' }}>
                              <th style={{ padding: '6px 4px' }}>ELEMENT</th>
                              <th style={{ padding: '6px 4px' }}>MARKDOWN</th>
                              <th style={{ padding: '6px 4px' }}>RESULT</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: '1px dashed var(--ink-light-grey)' }}>
                              <td style={{ padding: '6px 4px' }}>Heading 1</td>
                              <td style={{ padding: '6px 4px' }}><code># Title</code></td>
                              <td style={{ padding: '6px 4px', fontSize: '14px', fontWeight: 'bold' }}>Title</td>
                            </tr>
                            <tr style={{ borderBottom: '1px dashed var(--ink-light-grey)' }}>
                              <td style={{ padding: '6px 4px' }}>Heading 2</td>
                              <td style={{ padding: '6px 4px' }}><code>## Section</code></td>
                              <td style={{ padding: '6px 4px', fontSize: '12px', fontWeight: 'bold' }}>Section</td>
                            </tr>
                            <tr style={{ borderBottom: '1px dashed var(--ink-light-grey)' }}>
                              <td style={{ padding: '6px 4px' }}>Bold Text</td>
                              <td style={{ padding: '6px 4px' }}><code>**bold**</code></td>
                              <td style={{ padding: '6px 4px' }}><strong>bold</strong></td>
                            </tr>
                            <tr style={{ borderBottom: '1px dashed var(--ink-light-grey)' }}>
                              <td style={{ padding: '6px 4px' }}>Italic Text</td>
                              <td style={{ padding: '6px 4px' }}><code>*italic*</code></td>
                              <td style={{ padding: '6px 4px' }}><em>italic</em></td>
                            </tr>
                            <tr style={{ borderBottom: '1px dashed var(--ink-light-grey)' }}>
                              <td style={{ padding: '6px 4px' }}>Inline Code</td>
                              <td style={{ padding: '6px 4px' }}><code>`code`</code></td>
                              <td style={{ padding: '6px 4px' }}><code style={{ padding: '2px 4px', background: 'var(--paper-bg-darker)' }}>code</code></td>
                            </tr>
                            <tr style={{ borderBottom: '1px dashed var(--ink-light-grey)' }}>
                              <td style={{ padding: '6px 4px' }}>Code Block</td>
                              <td style={{ padding: '6px 4px' }}><code>```javascript \n code \n ```</code></td>
                              <td style={{ padding: '6px 4px' }}><pre style={{ margin: 0, padding: '4px', background: 'var(--paper-bg-darker)', display: 'inline-block' }}>code</pre></td>
                            </tr>
                            <tr style={{ borderBottom: '1px dashed var(--ink-light-grey)' }}>
                              <td style={{ padding: '6px 4px' }}>Hyperlink</td>
                              <td style={{ padding: '6px 4px' }}><code>[Text](URL)</code></td>
                              <td style={{ padding: '6px 4px' }}><a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--ink-red)', textDecoration: 'underline' }}>Text</a></td>
                            </tr>
                            <tr style={{ borderBottom: '1px dashed var(--ink-light-grey)' }}>
                              <td style={{ padding: '6px 4px' }}>Blockquote</td>
                              <td style={{ padding: '6px 4px' }}><code>&gt; Quote</code></td>
                              <td style={{ padding: '6px 4px', fontStyle: 'italic', borderLeft: '2px solid var(--ink-red)', paddingLeft: '6px' }}>Quote</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '6px 4px' }}>Bulleted List</td>
                              <td style={{ padding: '6px 4px' }}><code>- Item</code> or <code>* Item</code></td>
                              <td style={{ padding: '6px 4px' }}>• Item</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    className="btn" 
                    disabled={isPublishing}
                    style={{ padding: '12px 0', marginTop: '8px', letterSpacing: '0.06em', fontSize: '13px', width: '100%' }}
                  >
                    {isPublishing ? "PUBLISHING DISPATCH..." : "PUBLISH DISPATCH ON-CHAIN"}
                  </button>

                  {publishStatusMsg && (
                    <div className="mono-text" style={{ marginTop: '8px', fontSize: '11px', color: 'var(--ink-red)', textAlign: 'center', border: '1px dashed var(--ink-red)', padding: '8px', background: 'rgba(186,45,45,0.03)' }}>
                      {publishStatusMsg}
                    </div>
                  )}
                </form>
              </div>
            ) : (
              <div className="dispatch-writer-container">
                {editingArticle ? (
                  /* Edit Article Form */
                  <form onSubmit={handleEditArticleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ink-black)', paddingBottom: '8px' }}>
                      <h3 className="serif-title font-italic" style={{ margin: 0, fontSize: '20px' }}>✎ EDITING DISPATCH: <span style={{ color: 'var(--ink-red)' }}>{editingArticle.title}</span></h3>
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingArticle(null);
                          setEditTitle("");
                          setEditContent("");
                          setEditPrice("");
                          setEditStatusMsg("");
                        }}
                        className="btn btn-secondary" 
                        style={{ padding: '6px 16px', fontSize: '11px' }}
                      >
                        BACK TO LIST
                      </button>
                    </div>

                    <div className="writer-field-group">
                      <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>1. DISPATCH TITLE</label>
                      <input 
                        type="text" 
                        required 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="e.g. Decentralized Governance in Autonomous Agent Networks" 
                        className="writer-input"
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="writer-field-group">
                        <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>2. READ TARIFF (USDC)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0.01" 
                          max="10.00"
                          required 
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="writer-input"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        />
                      </div>
                      <div className="writer-field-group">
                        <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>3. RECIPIENT WALLET (LOCKED)</label>
                        <input 
                          type="text" 
                          disabled
                          value={getPublisherRecord(user?.email?.address || "")?.walletAddress || ""}
                          className="writer-input"
                          style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--paper-bg-darker)', color: 'var(--ink-grey)', border: '1px solid var(--ink-light-grey)' }}
                        />
                      </div>
                    </div>

                    <div className="writer-field-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>4. CONTENT (MARKDOWN & DRAG-PASTE SUPPORTED)</label>
                        <span className="mono-text" style={{ fontSize: '9px', color: 'var(--ink-grey)' }}>Drag-and-drop a .md file or paste content directly</span>
                      </div>

                      {/* Editor & Preview layout */}
                      <div className="editor-layout">
                        <div className="editor-pane-container">
                          {/* Formatting Toolbar */}
                          <div className="format-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              <button type="button" className="btn-format" onClick={() => insertMarkdown("h1", true)}>H1</button>
                              <button type="button" className="btn-format" onClick={() => insertMarkdown("h2", true)}>H2</button>
                              <button type="button" className="btn-format" onClick={() => insertMarkdown("h3", true)}>H3</button>
                              <button type="button" className="btn-format" onClick={() => insertMarkdown("bold", true)}>B</button>
                              <button type="button" className="btn-format" onClick={() => insertMarkdown("italic", true)}>I</button>
                              <button type="button" className="btn-format" onClick={() => insertMarkdown("code", true)}>&lt;&gt;</button>
                              <button type="button" className="btn-format" onClick={() => insertMarkdown("codeblock", true)}>BLOCKCODE</button>
                              <button type="button" className="btn-format" onClick={() => insertMarkdown("link", true)}>LINK</button>
                              <button type="button" className="btn-format" onClick={() => insertMarkdown("quote", true)}>QUOTE</button>
                              <button type="button" className="btn-format" onClick={() => insertMarkdown("list", true)}>LIST</button>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <label htmlFor="markdown-file-import-edit" className="btn-format" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}>
                                📥 IMPORT MD
                              </label>
                              <input 
                                type="file" 
                                id="markdown-file-import-edit" 
                                accept=".md,.txt" 
                                onChange={(e) => handleImportMarkdown(e, true)} 
                                style={{ display: 'none' }} 
                              />
                            </div>
                          </div>

                          <textarea
                            id="dispatch-editor-textarea-edit"
                            required
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onScroll={handleEditorScroll}
                            placeholder="Loading content or type here..."
                            className="writer-textarea"
                          />
                        </div>
                        
                        <div className="preview-pane">
                          <div className="preview-pane-title">LIVE PREVIEW (16:9 RENDER)</div>
                          <div 
                            className="content-text markdown-render" 
                            style={{ height: 'calc(100% - 24px)', overflowY: 'auto', textJustify: 'auto', columnCount: '1' }}
                            dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(editContent) || "<p style='color: var(--ink-grey); font-style: italic;'>No content written yet. Start typing or paste Markdown to see layout preview.</p>" }}
                          />
                        </div>
                      </div>

                      {/* Word Count & Status Bar */}
                      <div className="editor-status-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '8px 12px', border: '1px solid var(--ink-black)', backgroundColor: 'var(--paper-accent)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <span><strong>WORDS:</strong> {getWordCount(editContent)}</span>
                          <span><strong>CHARACTERS:</strong> {editContent.length}</span>
                          <span><strong>EST. READ TIME:</strong> ~{Math.ceil(getWordCount(editContent) / 200) || 1} MIN</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="save-status-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--ink-red)', display: 'inline-block' }}></span>
                          <span style={{ color: 'var(--ink-black)', fontWeight: 'bold' }}>EDITING MODE</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button 
                        type="submit" 
                        className="btn" 
                        disabled={isEditingSubmit}
                        style={{ flex: 1, padding: '12px 0', letterSpacing: '0.06em', fontSize: '13px' }}
                      >
                        {isEditingSubmit ? "SAVING CHANGES..." : "SAVE CHANGES"}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingArticle(null);
                          setEditTitle("");
                          setEditContent("");
                          setEditPrice("");
                          setEditStatusMsg("");
                        }}
                        className="btn btn-secondary" 
                        style={{ flex: 0.3, padding: '12px 0', fontSize: '13px' }}
                      >
                        CANCEL
                      </button>
                    </div>

                    {editStatusMsg && (
                      <div className="mono-text" style={{ marginTop: '8px', fontSize: '11px', color: 'var(--ink-red)', textAlign: 'center', border: '1px dashed var(--ink-red)', padding: '8px', background: 'rgba(186,45,45,0.03)' }}>
                        {editStatusMsg}
                      </div>
                    )}
                  </form>
                ) : (
                  /* Articles List */
                  <div>
                    <div style={{ borderBottom: '1px solid var(--ink-black)', paddingBottom: '12px', marginBottom: '20px' }}>
                      <h3 className="serif-title font-italic" style={{ margin: 0, fontSize: '24px' }}>PUBLISHED DISPATCHES</h3>
                      <p className="mono-text text-muted" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 0 0' }}>
                        MANAGE AND ARDUOUSLY MAINTAIN YOUR PUBLIC ARCHIVES
                      </p>
                    </div>

                    {articles.filter(art => art.author.toLowerCase() === (getPublisherRecord(user?.email?.address || "")?.name || "").toLowerCase()).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--ink-light-grey)', background: 'var(--paper-accent)' }}>
                        <p className="serif-body" style={{ fontSize: '15px', color: 'var(--ink-grey)', margin: 0 }}>
                          You have not published any dispatches yet. Go to the <strong>✎ WRITE DISPATCH</strong> tab to create one.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {articles
                          .filter(art => art.author.toLowerCase() === (getPublisherRecord(user?.email?.address || "")?.name || "").toLowerCase())
                          .map((art) => {
                            const isLocal = art.id.startsWith("local-");
                            return (
                              <div 
                                key={art.id} 
                                style={{ 
                                  border: '2px solid var(--ink-black)', 
                                  padding: '16px', 
                                  background: 'var(--paper-bg)', 
                                  boxShadow: '4px 4px 0 var(--ink-black)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '12px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                                  <div>
                                    <h4 className="serif-title font-bold" style={{ margin: 0, fontSize: '18px', color: 'var(--ink-black)' }}>
                                      {art.title}
                                    </h4>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                                      <span className="mono-text" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--ink-red)' }}>
                                        TARIFF: {art.price} USDC
                                      </span>
                                      <span style={{ color: 'var(--ink-light-grey)' }}>•</span>
                                      <span className="mono-text" style={{ fontSize: '10px', color: 'var(--ink-grey)' }}>
                                        ID: {art.id}
                                      </span>
                                      <span style={{ color: 'var(--ink-light-grey)' }}>•</span>
                                      {isLocal ? (
                                        <span className="mono-text" style={{ fontSize: '9px', border: '1px dashed var(--ink-red)', color: 'var(--ink-red)', padding: '2px 6px', background: 'rgba(186,45,45,0.02)', fontWeight: 'bold' }}>
                                          LOCAL DRAFT
                                        </span>
                                      ) : (
                                        <span className="mono-text" style={{ fontSize: '9px', border: '1px solid var(--ink-black)', color: 'var(--ink-black)', padding: '2px 6px', background: 'var(--paper-accent)', fontWeight: 'bold' }}>
                                          ON-CHAIN
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      type="button"
                                      onClick={() => startEditing(art)}
                                      className="btn btn-sm btn-secondary" 
                                      style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      ✎ EDIT
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleDeleteArticle(art)}
                                      className="btn btn-sm btn-danger" 
                                      style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', background: 'none', border: '1px solid var(--ink-red)', color: 'var(--ink-red)', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      🗑 DELETE
                                    </button>
                                  </div>
                                </div>

                                <p className="serif-body" style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: 'var(--ink-grey)' }}>
                                  {art.snippet || generateClientSnippet(art.content)}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
          )}
        </div>
      ) : isAdminView ? (
        <div className="portal-scroll-container" style={{ flex: '1', overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column' }}>
          {!isAdminAuthenticated ? (
          <main className="admin-login-container" style={{ padding: '32px', maxWidth: '420px', margin: '80px auto', border: '2px solid var(--ink-black)', backgroundColor: 'var(--paper-accent)', boxShadow: '6px 6px 0 var(--ink-black)', textAlign: 'center' }}>
            <div className="greek-key"></div>
            <h2 className="serif-title font-italic" style={{ color: 'var(--ink-red)', fontSize: '24px', marginBottom: '8px' }}>ADMIN ACCESS CONTROL</h2>
            <p className="mono-text text-muted" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '24px' }}>
              Verified Privy administrator session required
            </p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setAdminAuthError("");
              if (!authenticated) {
                openLogin();
                return;
              }
              try {
                const response = await authFetch(`${BACKEND_URL}/api/admin/session`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({})
                });
                if (response.ok) {
                  setIsAdminAuthenticated(true);
                  setAdminAuthError("");
                } else {
                  const data = await safeParseResponse(response);
                  setAdminAuthError(data.error || "THIS ACCOUNT IS NOT AN ADMINISTRATOR");
                }
              } catch (err) {
                console.error("Failed to authorize admin session:", err);
                // SECURITY FIX: Removed hardcoded password fallback.
                // Admin auth must go through the backend server.
                setAdminAuthError("SERVER UNREACHABLE — Cannot authenticate");
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button type="submit" className="btn" style={{ padding: '10px 0', letterSpacing: '0.06em', fontSize: '12px' }}>
                {authenticated ? "VERIFY ADMIN ACCOUNT" : "SIGN IN WITH PRIVY"}
              </button>
            </form>

            {adminAuthError && (
              <div className="mono-text" style={{ marginTop: '16px', fontSize: '11px', color: 'var(--ink-red)', border: '1px dashed var(--ink-red)', padding: '6px', background: 'rgba(186,45,45,0.05)' }}>
                {adminAuthError}
              </div>
            )}
            <div style={{ marginTop: '24px', borderTop: '1px dashed var(--ink-light-grey)', paddingTop: '16px' }}>
              <button 
                className="btn btn-sm btn-secondary" 
                onClick={() => handleToggleAdminView(false)}
                style={{ padding: '4px 12px', fontSize: '10px' }}
              >
                RETURN TO READER
              </button>
            </div>
          </main>
        ) : (
          <main className="admin-container" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)' }}>
          <div className="greek-key"></div>
          <h1 className="serif-title font-italic" style={{ textAlign: 'center', marginBottom: '8px', fontSize: '36px' }}>Publisher Administration Portal</h1>
          <p className="mono-text text-muted" style={{ textAlign: 'center', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            REGISTRY & CRYPTOGRAPHIC VERIFICATION CONSOLE
          </p>

          <section className="surfai-admin-card" aria-labelledby="surfai-admin-title">
            <header className="surfai-admin-header">
              <div>
                <span className="surfai-admin-kicker">PROTECTED EDITION CONTROL</span>
                <h2 id="surfai-admin-title">SurfAI Content Desk</h2>
                <p>Update the paid report and its protected PDF and video sources.</p>
              </div>
              <div className="surfai-admin-assets" aria-label="SurfAI asset status">
                <span className={surfAIAdminDraft.pdfUrl ? 'is-configured' : ''}>PDF {surfAIAdminDraft.pdfUrl ? 'READY' : 'EMPTY'}</span>
                <span className={surfAIAdminDraft.videoUrl ? 'is-configured' : ''}>VIDEO {surfAIAdminDraft.videoUrl ? 'READY' : 'EMPTY'}</span>
              </div>
            </header>

            {surfAIAdminPhase === "loading" ? (
              <div className="surfai-admin-loading" role="status">Loading protected SurfAI configuration…</div>
            ) : (
              <form className="surfai-admin-form" onSubmit={handleSurfAIAdminSubmit}>
                <div className="surfai-admin-field surfai-admin-field-wide">
                  <label htmlFor="surfai-admin-title-input">Edition title</label>
                  <input
                    id="surfai-admin-title-input"
                    type="text"
                    minLength="3"
                    maxLength="200"
                    required
                    value={surfAIAdminDraft.title}
                    onChange={(event) => handleSurfAIAdminChange("title", event.target.value)}
                  />
                </div>

                <div className="surfai-admin-field surfai-admin-field-wide">
                  <label htmlFor="surfai-admin-snippet">Public preview</label>
                  <textarea
                    id="surfai-admin-snippet"
                    rows="3"
                    minLength="10"
                    maxLength="500"
                    required
                    value={surfAIAdminDraft.snippet}
                    onChange={(event) => handleSurfAIAdminChange("snippet", event.target.value)}
                  />
                  <small>This text is visible before payment. {surfAIAdminDraft.snippet.length}/500</small>
                </div>

                <div className="surfai-admin-field surfai-admin-field-wide">
                  <label htmlFor="surfai-admin-content">Paid report content · Markdown</label>
                  <textarea
                    id="surfai-admin-content"
                    className="surfai-admin-content-input"
                    rows="16"
                    required
                    value={surfAIAdminDraft.content}
                    onChange={(event) => handleSurfAIAdminChange("content", event.target.value)}
                    placeholder="## SurfAI Daily Intelligence Dispatch"
                  />
                  <small>Only entitled readers receive this field from the API.</small>
                </div>

                <div className="surfai-admin-field">
                  <label htmlFor="surfai-admin-price">Tariff · USDC</label>
                  <input
                    id="surfai-admin-price"
                    type="number"
                    min="0.000001"
                    max="1000"
                    step="0.000001"
                    required
                    value={surfAIAdminDraft.price}
                    onChange={(event) => handleSurfAIAdminChange("price", event.target.value)}
                  />
                </div>

                <div className="surfai-admin-field">
                  <label htmlFor="surfai-admin-pdf">Protected PDF URL</label>
                  <input
                    id="surfai-admin-pdf"
                    type="url"
                    maxLength="2048"
                    value={surfAIAdminDraft.pdfUrl}
                    onChange={(event) => handleSurfAIAdminChange("pdfUrl", event.target.value)}
                    placeholder="https://media.example/report.pdf"
                  />
                  <small>HTTPS only. Leave empty to hide the PDF action.</small>
                </div>

                <div className="surfai-admin-field surfai-admin-field-wide">
                  <label htmlFor="surfai-admin-video">Protected video URL</label>
                  <input
                    id="surfai-admin-video"
                    type="url"
                    maxLength="2048"
                    value={surfAIAdminDraft.videoUrl}
                    onChange={(event) => handleSurfAIAdminChange("videoUrl", event.target.value)}
                    placeholder="https://media.example/briefing.mp4"
                  />
                  <small>HTTPS only. The URL is returned only after entitlement verification.</small>
                </div>

                <div className="surfai-admin-actions surfai-admin-field-wide">
                  <div className={`surfai-admin-status is-${surfAIAdminPhase}`} role="status" aria-live="polite">
                    {surfAIAdminStatus || "Changes are published immediately after saving."}
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={fetchAdminSurfAI} disabled={surfAIAdminPhase === "saving"}>
                    RESET FORM
                  </button>
                  <button type="submit" className="btn" disabled={surfAIAdminPhase === "saving" || !surfAIAdminDraft.content.trim()}>
                    {surfAIAdminPhase === "saving" ? "PUBLISHING…" : "SAVE SURFAI EDITION"}
                  </button>
                </div>
              </form>
            )}
          </section>

          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
            {/* Left pane: Combined column for forms */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: '1 1 350px', maxWidth: '420px', width: '100%' }}>
              {/* Card 1: Register New Publisher */}
              <div className="vintage-form-card" style={{ border: '2px solid var(--ink-black)', padding: '24px', backgroundColor: 'var(--paper-accent)', boxShadow: '4px 4px 0 var(--ink-black)', width: '100%' }}>
                <div style={{ fontFamily: 'var(--font-headline)', fontWeight: 'bold', fontSize: '15px', color: 'var(--ink-red)', borderBottom: '1px solid var(--ink-black)', paddingBottom: '6px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Register New Publisher
                </div>
                <form onSubmit={handleCreatePublisher} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>1. PUBLISHER PSEUDONYM / NAME</label>
                    <input 
                      type="text" 
                      required 
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Satoshi Nakamoto" 
                      style={{ padding: '8px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-serif)', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>2. REGISTRATION EMAIL</label>
                    <input 
                      type="email" 
                      required 
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="e.g. satoshi@bitcoin.org" 
                      style={{ padding: '8px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-serif)', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>3. VERIFIED DOMAIN</label>
                    <input 
                      type="text" 
                      required 
                      value={adminDomain}
                      onChange={(e) => setAdminDomain(e.target.value)}
                      placeholder="e.g. bitcoin.org" 
                      style={{ padding: '8px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-serif)', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>4. RECIPIENT WALLET ADDRESS (EVM)</label>
                    <input 
                      type="text" 
                      required 
                      value={adminWallet}
                      onChange={(e) => setAdminWallet(e.target.value)}
                      placeholder="e.g. 0xf39Fd..." 
                      style={{ padding: '8px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>5. EDITORIAL CATEGORY</label>
                    <select 
                      value={adminCategory}
                      onChange={(e) => setAdminCategory(e.target.value)}
                      style={{ padding: '8px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-serif)', fontSize: '13px' }}
                    >
                      <option>Web3 Infrastructures & Protocols</option>
                      <option>AI-Agent Autonomous Economics</option>
                      <option>Decentralized High-Performance Compute</option>
                      <option>On-Chain Micropayments & L2 Scaling</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-sm" style={{ padding: '10px 0', marginTop: '8px', letterSpacing: '0.06em', fontSize: '12px' }}>
                    INDUCT PUBLISHER
                  </button>
                </form>
                {adminStatusMsg && (
                  <div className="mono-text" style={{ marginTop: '12px', fontSize: '11px', color: 'var(--ink-red)', textAlign: 'center', border: '1px dashed var(--ink-red)', padding: '6px', background: 'rgba(186,45,45,0.05)' }}>
                    {adminStatusMsg}
                  </div>
                )}
              </div>

            </div>

            {/* Right pane: Publishers List */}
            <div style={{ flex: '2 1 600px', border: '2px solid var(--ink-black)', padding: '24px', backgroundColor: 'var(--paper-bg)', boxShadow: '4px 4px 0 var(--ink-black)', minWidth: '320px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ink-black)', paddingBottom: '6px', marginBottom: '16px' }}>
                <span style={{ fontFamily: 'var(--font-headline)', fontWeight: 'bold', fontSize: '15px', color: 'var(--ink-black)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Publisher Directory Ledger
                </span>
                <span className="mono-text" style={{ fontSize: '10px', background: 'var(--ink-black)', color: 'var(--paper-bg)', padding: '2px 6px', display: 'inline-block' }}>
                  {Object.keys(publishers).length} records
                </span>
              </div>

              <div className="admin-table-wrapper" style={{ overflowX: 'auto' }}>
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'var(--font-serif)', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--ink-black)', fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--ink-grey)' }}>
                      <th style={{ padding: '8px 4px' }}>Publisher Info</th>
                      <th style={{ padding: '8px 4px' }}>Domain Beat</th>
                      <th style={{ padding: '8px 4px' }}>Wallet Identity</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center' }}>Accredited</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(publishers).length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-grey)' }}>
                          No publisher records found. Add one above!
                        </td>
                      </tr>
                    ) : (
                      Object.keys(publishers).map((email) => {
                        const pub = publishers[email];
                        return (
                          <tr key={email} style={{ borderBottom: '1px solid var(--ink-light-grey)' }}>
                            <td style={{ padding: '12px 4px' }}>
                              <strong style={{ color: 'var(--ink-black)' }}>{pub.name}</strong><br/>
                              <span style={{ fontSize: '10.5px', color: 'var(--ink-grey)', fontFamily: 'var(--font-mono)' }}>{email}</span>
                            </td>
                            <td style={{ padding: '12px 4px' }}>
                              <span className="mono-text" style={{ fontSize: '11.5px', fontWeight: 'bold' }}>{pub.domain}</span><br/>
                              <span style={{ fontSize: '9px', color: 'var(--ink-grey)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{pub.category}</span>
                            </td>
                            <td style={{ padding: '12px 4px' }}>
                              <span className="mono-text" style={{ fontSize: '11px' }} title={pub.walletAddress}>
                                {shortenAddress(pub.walletAddress)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 4px', textAlign: 'center' }}>
                              {pub.verified ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', color: '#1d9bf0', fontWeight: 'bold', gap: '3px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                                  <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', fill: '#1d9bf0', flexShrink: 0 }}>
                                    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.17-2.9-.81-3.88-.98-.98-2.49-1.27-3.88-.81C14.67 2.66 13.43 1.75 12 1.75s-2.67.91-3.37 2.22C7.24 3.51 5.73 3.8 4.75 4.78c-.98.98-1.27 2.49-.81 3.88C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.17 2.9.81 3.88.98.98 2.49 1.27 3.88.81.7 1.31 1.94 2.22 3.37 2.22s2.67-.91 3.37-2.22c1.39.46 2.9.17 3.88-.81.98-.98 1.27-2.49.81-3.88 1.31-.7 2.22-1.94 2.22-3.37zM10.25 16.25L6 12l1.5-1.5 2.75 2.75 6.25-6.25 1.5 1.5-8 8z"></path>
                                  </svg>
                                  VERIFIED
                                </span>
                              ) : (
                                <span style={{ color: 'var(--ink-grey)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>UNVERIFIED</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 4px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button 
                                  className={`btn btn-sm ${pub.verified ? 'btn-secondary' : ''}`} 
                                  onClick={() => handleToggleVerify(email, pub.verified)}
                                  style={{ padding: '3px 8px', fontSize: '9px', whiteSpace: 'nowrap' }}
                                >
                                  {pub.verified ? "Revoke Seal" : "Grant Seal"}
                                </button>
                                <button 
                                  className="btn btn-sm btn-secondary" 
                                  onClick={() => handleDeletePublisher(email)}
                                  style={{ padding: '3px 8px', fontSize: '9px', color: 'var(--ink-red)', border: '1px solid var(--ink-red)', whiteSpace: 'nowrap' }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="greek-key" style={{ marginTop: '32px' }}></div>
        </main>
        )}
        </div>
      ) : (
        <main className={`main-container ${selectedArticle ? 'has-selected-article' : ''}`}>
          {/* LEFT SIDEBAR */}
          <section className="sidebar">
            <div className="section-title">
              <h2 ref={articleListHeadingRef} tabIndex="-1">LATEST DISPATCHES</h2>
              <span className="item-count">{articles.length} columns published</span>
            </div>
            <div className="article-list">
              {articles.map((art) => (
                <article
                  key={`${art.id}-${art.author}`}
                  className={`article-card ${selectedArticle?.id === art.id && selectedArticle?.author.toLowerCase() === art.author.toLowerCase() ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="article-card-select"
                    onClick={() => handleSelectArticle(art)}
                    aria-current={selectedArticle?.id === art.id ? 'true' : undefined}
                    aria-label={`Read ${art.title} by ${art.author}, ${art.price} USDC`}
                  >
                    <div className="card-title">{art.title}</div>
                    <div className="card-meta">
                      <span>By {art.author}</span>
                      <span className="price-tag">
                        <UsdcCoinIcon size={12} className="coin-sidebar" style={{ marginRight: '3px', marginTop: '-2px' }} />
                        {art.price}
                      </span>
                    </div>
                    <div className="card-snippet">{art.snippet || generateClientSnippet(art.content)}</div>
                  </button>
                  {art.verified && (
                    <span className="article-card-verified">
                      <VerifiedBadge onApplyClick={handleOpenApplyForm} />
                    </span>
                  )}
                </article>
              ))}
            </div>
          </section>

          {/* RIGHT CONTENT */}
          <section className="viewer" style={{ position: 'relative' }} aria-label="Article reader">
            {/* SURFAI DAILY INTELLIGENCE DESK */}
            {!isPublisherView && !isAdminView && (
              <aside className="surfai-ticker-bar" aria-label="SurfAI intelligence desk">
                <button
                  type="button"
                  className="surfai-logo-button"
                  onClick={openSurfDailyDispatch}
                  title="Open the SurfAI daily intelligence dispatch"
                >
                  <SurfAILogo size={30} />
                  <span className="surfai-brand-copy">
                    <strong>SurfAI</strong>
                    <small>Intelligence desk</small>
                  </span>
                </button>

                <div className="surfai-ticker-content">
                  <span className="surfai-live-dot" aria-hidden="true"></span>
                  <span className="surfai-ticker-kicker">Daily signal</span>
                  <button
                    type="button"
                    className="surfai-ticker-link"
                    onClick={openSurfDailyDispatch}
                    title="Read and unlock the AI report"
                  >
                    {getDailyAISurfArticle().title}
                  </button>
                </div>

                <button
                  type="button"
                  className="surfai-ticker-action"
                  onClick={handleSurfLogoClick}
                  title="Generate an AI video briefing"
                >
                  <span aria-hidden="true">{unlockedArticles["surfai-daily"] ? '▶' : '◆'}</span>
                  <span>{unlockedArticles["surfai-daily"] ? 'Video brief' : 'Unlock video'}</span>
                </button>
              </aside>
            )}

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
            ) : showSurfVideoMockup ? (
              <div className="viewer-state surfai-studio">
                <header className="surfai-studio-header">
                  <div className="surfai-studio-heading">
                    <SurfAILogo size={48} />
                    <div>
                      <span className="surfai-eyebrow">Autonomous media desk / 01</span>
                      <h2>Turn today&apos;s signal into a briefing.</h2>
                      <p>SurfAI assembles market intelligence, editorial structure and narration into one concise video dispatch.</p>
                    </div>
                  </div>
                  <button type="button" className="surfai-text-button" onClick={() => setShowSurfVideoMockup(false)}>
                    Close studio
                  </button>
                </header>

                <div className="surfai-signal-strip" aria-label="Video briefing specifications">
                  <div><span>Source</span><strong>Daily signal matrix</strong></div>
                  <div><span>Format</span><strong>16:9 editorial brief</strong></div>
                  <div><span>Delivery</span><strong>Protected R2 media</strong></div>
                </div>

                <section className={`surfai-workbench ${videoReady ? 'is-ready' : 'is-processing'}`} aria-live="polite">
                  {videoSimulating && (
                    <>
                      <div className="surfai-workbench-head">
                        <div>
                          <span className="surfai-eyebrow">Generation pipeline</span>
                          <h3>Synthesizing video intelligence</h3>
                        </div>
                        <span className="surfai-status-pill"><i></i> Processing</span>
                      </div>

                      <div
                        className="surfai-progress"
                        role="progressbar"
                        aria-label="Video generation progress"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={videoSimStep === 1 ? 33 : videoSimStep === 2 ? 66 : 100}
                      >
                        <span style={{ width: videoSimStep === 1 ? '33%' : videoSimStep === 2 ? '66%' : '100%' }}></span>
                      </div>

                      <ol className="surfai-pipeline-list">
                        <li className={videoSimStep >= 1 ? 'is-active' : ''}>
                          <b>01</b><span><strong>Ingest intelligence</strong>Load market flows and the latest SurfAI weights.</span>
                        </li>
                        <li className={videoSimStep >= 2 ? 'is-active' : ''}>
                          <b>02</b><span><strong>Build the narrative</strong>Render frames and synchronize editorial voiceover.</span>
                        </li>
                        <li className={videoSimStep >= 3 ? 'is-active' : ''}>
                          <b>03</b><span><strong>Seal the dispatch</strong>Compile the MP4 and publish the protected payload.</span>
                        </li>
                      </ol>
                    </>
                  )}

                  {videoReady && (
                    <>
                      <div className="surfai-workbench-head">
                        <div>
                          <span className="surfai-eyebrow">Latest output</span>
                          <h3>Your video dispatch is ready</h3>
                        </div>
                        <span className="surfai-status-pill is-success"><i></i> Ready</span>
                      </div>

                      <div className="surfai-video-frame">
                        <span className="surfai-video-corner">SurfAI / Daily intelligence</span>
                        <video controls autoPlay className="preview-video">
                          <source src={surfVideoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      </div>

                      <div className="surfai-studio-actions">
                        <button type="button" className="btn surfai-primary-button" onClick={triggerVideoSimulation}>
                          Generate a fresh cut
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={openSurfDailyDispatch}>
                          Read today&apos;s dispatch
                        </button>
                      </div>
                    </>
                  )}
                </section>
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
                      <span style={{ fontSize: '16px' }}>⚠</span> REQUEST ERROR
                    </div>
                    <div>{error}</div>
                    {isDomainAuthorizationError(error) && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(186, 45, 45, 0.25)', fontSize: '11px', color: 'var(--ink-grey)' }}>
                        <strong>Next Steps:</strong>
                        <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li>Ensure <strong>{window.location.origin}</strong> is added to <strong>Allowed Domains</strong> in the Privy Developer Dashboard (dashboard.privy.io) under settings.</li>
                          <li>Try clearing browser cookies/site data and reloading the page.</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}
                <div className="stamp-row">
                  {/* Stamp 1: Register Status */}
                  {!authenticated ? (
                    <button
                      type="button"
                      className="rubber-stamp stamp-red clickable-stamp" 
                      onClick={openLogin}
                      title="Sign in"
                    >
                      SIGN IN TO UNLOCK
                    </button>
                  ) : (
                    <div className="rubber-stamp stamp-green">
                      ✔ REGISTER: SIGNED
                    </div>
                  )}

                  {/* Stamp 2: Vault Status */}
                  {(!authenticated || !circleWallet) ? (
                    <button
                      type="button"
                      className="rubber-stamp stamp-red clickable-stamp"
                      onClick={openLogin}
                      title="Sign in to activate your wallet"
                    >
                      WALLET: SIGN IN REQUIRED
                    </button>
                  ) : (
                    <button type="button" className="rubber-stamp stamp-green clickable-stamp"
                      onClick={() => setShowWalletModal(true)}
                      title="Open USDC wallet"
                    >
                      WALLET: ACTIVE
                    </button>
                  )}

                  {/* Stamp 3: Network Status */}
                  <div className="rubber-stamp stamp-black">
                    ✦ ARC TESTNET ✦
                  </div>
                </div>
              </div>
            ) : (
              <div id="viewer-active" className="viewer-state">
                <button type="button" className="mobile-back-button" onClick={handleReturnToArticleList}>
                  ← Back to articles
                </button>
                <div className={`article-header ${selectedArticle.id === "surfai-daily" ? 'surfai-article-header' : ''}`}>
                  {selectedArticle.id === "surfai-daily" && (
                    <div className="surfai-article-kicker">
                      <SurfAILogo size={34} />
                      <span>Machine-curated intelligence · Daily edition</span>
                      <em>Signal / Live</em>
                    </div>
                  )}
                  <h1 ref={readerHeadingRef} tabIndex="-1" className="serif-title">{selectedArticle.title}</h1>
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
                          title="View transaction on-chain"
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
                    <div>
                      {selectedArticle.id === "surfai-daily" && (
                        <section className="surfai-briefing-intro" aria-label="SurfAI briefing status">
                          <div className="surfai-briefing-copy">
                            <span className="surfai-eyebrow">Access granted / Intelligence online</span>
                            <h2>The day&apos;s clearest signals, without the noise.</h2>
                            <p>Your payment credential has unlocked the complete AI-curated dispatch and its protected media assets.</p>
                          </div>
                          <div className="surfai-briefing-seal" aria-label="Verified on Arc Testnet">
                            <span>Verified</span>
                            <strong>ARC</strong>
                            <small>Testnet</small>
                          </div>
                          <dl className="surfai-briefing-metrics">
                            <div><dt>Coverage</dt><dd>Capital + compute</dd></div>
                            <div><dt>Access</dt><dd>Permanent</dd></div>
                            <div><dt>Settlement</dt><dd>0.15 USDC</dd></div>
                          </dl>
                        </section>
                      )}
                      <div 
                        className={`content-text premium-unlocked ${selectedArticle.id === "surfai-daily" ? 'surfai-premium-copy' : ''}`}
                        dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(selectedArticle.content) }}
                      />
                      
                      {selectedArticle.id === "surfai-daily" && (
                        <section className="surfai-report-card" aria-live="polite">
                          <div className="surfai-report-head">
                            <div className="surfai-report-title">
                              <SurfAILogo size={38} />
                              <div>
                                <span className="surfai-eyebrow">Protected document / PDF</span>
                                <h3>Secure report compiler</h3>
                              </div>
                            </div>
                            <span className="surfai-report-format">Signed · PDF</span>
                          </div>

                          {!pdfSimulating && !pdfReady && (
                            <div className="surfai-report-idle">
                              <div className="surfai-document-preview" aria-hidden="true">
                                <span>SurfAI</span>
                                <strong>Daily Intelligence<br />Dispatch</strong>
                                <i></i><i></i><i></i>
                                <small>Verified research edition</small>
                              </div>
                              <div>
                                <span className="surfai-eyebrow">Premium asset available</span>
                                <h4>Take the full report offline.</h4>
                                <p>Compile the complete analysis into a signed PDF, anchored to your verified access credential.</p>
                                <button type="button" className="btn surfai-primary-button" onClick={triggerPdfSimulation}>
                                  Compile protected report
                                </button>
                              </div>
                            </div>
                          )}

                          {pdfSimulating && (
                            <div className="surfai-report-processing">
                              <div className="surfai-workbench-head">
                                <div>
                                  <span className="surfai-eyebrow">Document pipeline</span>
                                  <h3>Compiling cryptographic report</h3>
                                </div>
                                <span className="surfai-status-pill"><i></i> Processing</span>
                              </div>

                              <div
                                className="surfai-progress"
                                role="progressbar"
                                aria-label="PDF compilation progress"
                                aria-valuemin="0"
                                aria-valuemax="100"
                                aria-valuenow={pdfSimStep === 1 ? 25 : pdfSimStep === 2 ? 55 : pdfSimStep === 3 ? 85 : 100}
                              >
                                <span style={{ width: pdfSimStep === 1 ? '25%' : pdfSimStep === 2 ? '55%' : pdfSimStep === 3 ? '85%' : '100%' }}></span>
                              </div>

                              <ol className="surfai-pipeline-list is-compact">
                                <li className={pdfSimStep >= 1 ? 'is-active' : ''}><b>01</b><span><strong>Verify access</strong>Confirm settlement credential on Arc Testnet.</span></li>
                                <li className={pdfSimStep >= 2 ? 'is-active' : ''}><b>02</b><span><strong>Compose document</strong>Structure the daily analysis matrix.</span></li>
                                <li className={pdfSimStep >= 3 ? 'is-active' : ''}><b>03</b><span><strong>Anchor and seal</strong>Publish the signed document to protected storage.</span></li>
                              </ol>
                            </div>
                          )}

                          {pdfReady && (
                            <div className="surfai-report-ready">
                              <div>
                                <span className="surfai-status-pill is-success"><i></i> Report ready</span>
                                <h4>Compiled, signed and anchored.</h4>
                                <p>Your protected PDF is ready. Its document fingerprint is attached to this edition.</p>
                                <code>sha256-4cf8e3c1a9d023bf...e08f3c80</code>
                              </div>
                              <div className="surfai-report-actions">
                                {selectedArticle.pdfUrl ? (
                                  <a className="btn surfai-primary-button" href={selectedArticle.pdfUrl} target="_blank" rel="noopener noreferrer">
                                    Download report
                                  </a>
                                ) : (
                                  <span className="surfai-asset-unavailable">Protected PDF is not configured.</span>
                                )}
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                  setPdfReady(false);
                                  setPdfSimStep(0);
                                }}>
                                  Re-compile
                                </button>
                              </div>
                            </div>
                          )}
                        </section>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="content-text-preview" style={{ fontStyle: 'italic', color: 'var(--ink-grey)', marginBottom: '24px', fontSize: '15px', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                        {selectedArticle.snippet || generateClientSnippet(selectedArticle.content)}
                      </div>

                      {/* PAYWALL */}
                      <div className={`paywall-card ${selectedArticle.id === "surfai-daily" ? 'surfai-paywall' : ''}`}>
                        {selectedArticle.id === "surfai-daily" && (
                          <div className="surfai-paywall-brand"><SurfAILogo size={40} /><span>SurfAI protected intelligence</span></div>
                        )}
                        <div className="paywall-title">{selectedArticle.id === "surfai-daily" ? 'Access the full signal' : 'Unlock this article'}</div>
                        <p className="paywall-intro">
                          {selectedArticle.id === "surfai-daily"
                            ? 'One payment unlocks the complete dispatch, signed PDF and AI video briefing.'
                            : 'Read the complete article with a one-time USDC payment.'}
                        </p>
                        {selectedArticle.id === "surfai-daily" && surfRequestedAsset === "video" && (
                          <div className="surfai-video-lock-notice" role="status">
                            <span aria-hidden="true">◆</span>
                            <div><strong>Video briefing locked</strong><small>Complete the one-time payment below to continue to the protected video.</small></div>
                          </div>
                        )}
                        
                        <div className="paywall-options-container">
                          <div className="paywall-option-box paywall-primary-option">
                            <div className="option-icon">🖋️</div>
                            <div className="option-title">READ THE FULL ARTICLE</div>
                            <p className="paywall-desc">
                              {!authenticated 
                                ? "Sign in to create your USDC wallet and continue."
                                : `Wallet ${shortenAddress(circleWallet?.address)} · Balance ${parseFloat(circleWallet?.balance || '0.00').toFixed(4)} USDC`
                              }
                            </p>
                            {!txStatus && (
                              <button className="btn btn-sm btn-paywall" onClick={handleUnlockOnChain}>
                                {!authenticated ? "SIGN IN TO CONTINUE" : (
                                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    UNLOCK FOR {selectedArticle.price} <UsdcCoinIcon size={14} className="coin-inline" /> USDC
                                  </span>
                                )}
                              </button>
                            )}
                          </div>

                          <details className="paywall-technical-details">
                            <summary>Developer demo: AI agent payment flow</summary>
                          <div className="paywall-option-box paywall-agent-option">
                            <div className="option-icon">🤖</div>
                            <div className="option-title">AI AGENT SIMULATION</div>
                            
                            {!isScraping ? (
                              <>
                                <p className="paywall-desc">
                                  Trigger simulated robot scraping sequence & micro-payments.
                                </p>
                                <button 
                                  className="btn btn-sm btn-paywall btn-secondary"
                                  onClick={triggerScrapeSimulation}
                                >
                                  RUN DEMO
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
                          </details>
                        </div>

                        {txStatus && (
                          <div className="tx-status-box" role="status" aria-live="polite" style={{ marginTop: '20px', width: '100%' }}>
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

                        {error && <div className="paywall-error" role="alert" style={{ marginTop: '15px', width: '100%' }}>{error}</div>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* APP-OWNED PRIVY EMAIL SIGN-IN MODAL */}
      {showSignInModal && !authenticated && (
        <div className="modal-overlay signin-modal-overlay" onClick={closeSignInModal}>
          <section
            className="signin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="wallet-close-btn" aria-label="Close sign in" onClick={closeSignInModal}>X</button>
            <div className="wallet-seal">* PRIVY SECURE ACCESS *</div>
            <h2 id="signin-dialog-title" className="serif-title font-italic">SIGN THE GUEST REGISTER</h2>
            <p className="mono-text signin-modal-copy">
              {signInStep === "email"
                ? "Enter your email to receive a one-time authentication code."
                : `Enter the code sent to ${signInEmail}.`}
            </p>
            <div className={`signin-readiness is-${authPhase}`} role="status">
              <span></span>
              {ready ? 'PRIVY READY · SECURE SESSION AVAILABLE' : 'SECURE SESSION STARTING · EMAIL SIGN-IN REMAINS AVAILABLE'}
            </div>

            {signInStep === "email" ? (
              <form className="signin-form" onSubmit={handleSendSignInCode}>
                <label htmlFor="signin-email" className="wallet-id-label">EMAIL ADDRESS</label>
                <input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={signInEmail}
                  onChange={(event) => setSignInEmail(event.target.value)}
                  placeholder="reader@example.com"
                  disabled={signInBusy}
                />
                <button type="submit" className="btn" disabled={signInBusy}>
                  {signInBusy ? "SENDING CODE..." : "SEND SIGN-IN CODE"}
                </button>
              </form>
            ) : (
              <form className="signin-form" onSubmit={handleVerifySignInCode}>
                <label htmlFor="signin-code" className="wallet-id-label">ONE-TIME CODE</label>
                <input
                  id="signin-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={signInCode}
                  onChange={(event) => setSignInCode(event.target.value)}
                  placeholder="123456"
                  disabled={signInBusy}
                />
                <button type="submit" className="btn" disabled={signInBusy}>
                  {signInBusy ? "VERIFYING..." : "VERIFY & SIGN IN"}
                </button>
                <button type="button" className="btn btn-secondary" disabled={signInBusy} onClick={() => { setSignInStep("email"); setSignInCode(""); setSignInError(""); }}>
                  CHANGE EMAIL
                </button>
              </form>
            )}

            {signInError && <div className="paywall-error signin-modal-error" role="alert">{signInError}</div>}
            <div className="signin-modal-divider"><span>OR</span></div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={signInBusy}
              onClick={handleWalletSignIn}
            >
              {signInBusy ? "PREPARING WALLET LOGIN..." : "CONNECT CRYPTO WALLET"}
            </button>
          </section>
        </div>
      )}

      {/* WALLET DEPOSIT & QR MODAL */}
      {showWalletModal && (
        <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
          <div
            ref={walletModalRef}
            className="modal-content vintage-wallet-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Vintage Close Button in the upper right corner */}
            <button type="button" className="wallet-close-btn" aria-label="Close wallet" onClick={() => setShowWalletModal(false)}>×</button>
            
            <div className="vintage-wallet-container">
              {/* LEFT COLUMN: IDs & INFO */}
              <div className="wallet-pane-left">
                <div className="wallet-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div className="wallet-seal">★ OFFICIAL IDENTITY CARD ★</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '6px' }}>
                    <img src={logoImg} alt="Paper Cut Seal Logo" style={{ height: '40px', width: '40px', borderRadius: '50%', border: '1.5px solid var(--ink-black)' }} />
                    <h3 id="wallet-dialog-title" className="wallet-title" style={{ margin: 0 }}>PAPER CUT WALLET</h3>
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
                  <button
                    type="button"
                    className="wallet-address-box mono-text" 
                    onClick={() => {
                      if (circleWallet?.address) {
                        handleCopyAddress(circleWallet.address);
                      }
                    }}
                    disabled={!circleWallet?.address}
                    title={circleWallet?.address ? "Click to copy address" : "Wallet not loaded"}
                  >
                    <span className="address-text">
                      {isLoadingWallet ? "LOADING/CREATING WALLET..." : (circleWallet?.address || "NOT INITIALIZED (CLICK SYNC/FAUCET TO RETRY)")}
                    </span>
                    <span className="copy-badge">{circleWallet?.address ? copyStatus : ""}</span>
                  </button>
                </div>

                <div className="wallet-id-group">
                  <div className="wallet-id-label">CURRENT BALANCE</div>
                  <div className="wallet-balance-row" style={{ display: 'flex', alignItems: 'center' }}>
                    <UsdcCoinIcon size={24} className="coin-balance-icon" style={{ marginRight: '6px' }} />
                    <span className="balance-num">
                      {isLoadingWallet ? "..." : parseFloat(circleWallet?.balance || "0.0000").toFixed(4)}
                    </span>
                    <span className="balance-denom">USDC</span>
                    <button 
                      onClick={handleSyncBalance} 
                      className="btn-sync-balance-vintage"
                      aria-label="Refresh USDC balance"
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

                <div className={`wallet-lifecycle-banner is-${readerLifecycle.walletPhase}`} role="status">
                  <span className="wallet-phase-dot" aria-hidden="true"></span>
                  <div>
                    <strong>{readerLifecycle.walletPhase === WALLET_PHASE.DEGRADED ? 'WALLET READY · BALANCE CACHED' : `WALLET ${readerLifecycle.walletPhase.toUpperCase()}`}</strong>
                    <small>
                      {readerLifecycle.walletMessage || (pendingPayments.length
                        ? `${pendingPayments.length} operation${pendingPayments.length === 1 ? '' : 's'} awaiting confirmation.`
                        : 'Identity, wallet and entitlement ledger are synchronized.')}
                    </small>
                  </div>
                </div>

                {!circleWallet && error && (
                  <div className="mono-text" style={{ fontSize: '10px', color: 'var(--ink-red)', border: '1px solid var(--ink-red)', padding: '8px', background: 'rgba(186,45,45,0.05)', marginBottom: '12px', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}>
                    <strong>WALLET LOAD ERROR:</strong> {error}
                    <button 
                      onClick={fetchUserCircleWallet}
                      style={{ 
                        display: 'block', 
                        marginTop: '6px', 
                        padding: '4px 8px', 
                        background: 'var(--ink-red)', 
                        color: 'white', 
                        border: '1px solid var(--ink-black)', 
                        cursor: 'pointer',
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      RETRY INITIALIZATION
                    </button>
                  </div>
                )}

                <div className="wallet-actions-section">
                  <button 
                    className="btn-faucet-stamp" 
                    onClick={handleRequestFaucet} 
                    disabled={faucetLoading}
                    style={{ width: '100%' }}
                  >
                    {faucetLoading ? "STAMPING TARIFF..." : "CLAIM 1.00 USDC FAUCET"}
                  </button>
                  {faucetSuccess && (
                    <div className="mono-text" style={{ fontSize: '9px', color: 'green', border: '1px dashed green', padding: '6px', background: 'rgba(0,128,0,0.03)', marginTop: '8px', textAlign: 'center' }}>
                      {faucetSuccess}
                    </div>
                  )}
                  {faucetError && (
                    <div className="mono-text" style={{ fontSize: '9px', color: 'var(--ink-red)', border: '1px dashed var(--ink-red)', padding: '6px', background: 'rgba(186,45,45,0.03)', marginTop: '8px', textAlign: 'center' }}>
                      {faucetError}
                    </div>
                  )}
                </div>

                <details className="wallet-disclosure">
                  <summary>Withdraw USDC</summary>
                <div className="wallet-actions-section wallet-withdraw-section">
                  <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="wallet-id-label" style={{ marginBottom: '2px' }}>USDC WITHDRAWAL TO EVM WALLET</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label htmlFor="withdraw-address" className="mono-text wallet-form-label">DESTINATION ADDRESS</label>
                      <input 
                        id="withdraw-address"
                        type="text" 
                        required 
                        value={withdrawAddress}
                        onChange={(e) => setWithdrawAddress(e.target.value)}
                        placeholder="0x..." 
                        style={{ 
                          padding: '6px 8px', 
                          border: '1px solid var(--ink-black)', 
                          background: 'var(--paper-bg)', 
                          fontFamily: 'var(--font-mono)', 
                          fontSize: '11px',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label htmlFor="withdraw-amount" className="mono-text wallet-form-label">AMOUNT (USDC)</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input 
                          id="withdraw-amount"
                          type="number" 
                          step="0.0001" 
                          min="0.0001" 
                          required 
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0.00" 
                          style={{ 
                            flex: 1,
                            padding: '6px 8px', 
                            border: '1px solid var(--ink-black)', 
                            background: 'var(--paper-bg)', 
                            fontFamily: 'var(--font-mono)', 
                            fontSize: '11px',
                            boxSizing: 'border-box'
                          }}
                        />
                        <button 
                          type="button" 
                          onClick={() => setWithdrawAmount(circleWallet?.balance || "0")}
                          className="btn-format"
                          style={{ fontSize: '9px', padding: '0 8px', height: 'auto', border: '1px solid var(--ink-black)', background: 'var(--paper-accent)', cursor: 'pointer' }}
                        >
                          MAX
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="btn" 
                      disabled={withdrawLoading || parseFloat(circleWallet?.balance || "0") <= 0}
                      style={{ padding: '8px 0', fontSize: '11px', letterSpacing: '0.05em', width: '100%', marginTop: '4px' }}
                    >
                      {withdrawLoading ? "EXECUTING WITHDRAWAL..." : "WITHDRAW FUNDS"}
                    </button>

                    {withdrawError && (
                      <div className="mono-text" style={{ fontSize: '9px', color: 'var(--ink-red)', border: '1px dashed var(--ink-red)', padding: '6px', background: 'rgba(186,45,45,0.03)', marginTop: '4px', wordBreak: 'break-word' }}>
                        {withdrawError}
                      </div>
                    )}
                    {withdrawSuccess && (
                      <div className="mono-text" style={{ fontSize: '9px', color: 'green', border: '1px dashed green', padding: '6px', background: 'rgba(0,128,0,0.03)', marginTop: '4px', wordBreak: 'break-word' }}>
                        {withdrawSuccess}
                      </div>
                    )}
                  </form>
                </div>
                </details>
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
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${smartWalletAddress || user?.wallet?.address}`}
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
