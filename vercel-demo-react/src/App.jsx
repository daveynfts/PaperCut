import React, { useState, useEffect } from 'react';
import { usePrivy, useWallets, useLogin } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import './App.css';
import logoImg from './assets/logo.png';

const INITIAL_ARTICLES = [
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

// Auto-infer backend URL on Vercel deployment if VITE_API_URL is not baked in
const getInferredBackendUrl = () => {
  const url = import.meta.env.VITE_API_URL;
  const isLocalHost = (val) => !val || val.includes("localhost") || val.includes("127.0.0.1");
  
  if (typeof window !== "undefined" && !isLocalHost(window.location.hostname)) {
    // Force relative path to use Vercel's rewrite rule for same-origin routing
    return "";
  }
  
  // For local frontend development, default to the live backend URL
  // so developers don't need to run the backend server locally.
  if (url && !isLocalHost(url)) {
    return url;
  }
  return "https://paper-cut-apce.vercel.app";
};
const BACKEND_URL = getInferredBackendUrl();

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

  const [circleWallet, setCircleWallet] = useState(null);
  const activeWallet = wallets ? wallets[0] : null;
  const smartWalletAddress = circleWallet?.address;

  const [selectedArticle, setSelectedArticle] = useState(null);
  const [unlockedArticles, setUnlockedArticles] = useState({});
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [chainId, setChainId] = useState(null);

  // Publisher Admin Portal States
  const [articles, setArticles] = useState(INITIAL_ARTICLES);
  const [publishers, setPublishers] = useState({});
  const [isAdminView, setIsAdminView] = useState(false);
  const [isPublisherView, setIsPublisherView] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminDomain, setAdminDomain] = useState("");
  const [adminWallet, setAdminWallet] = useState("");
  const [adminCategory, setAdminCategory] = useState("Web3 Infrastructures & Protocols");
  const [adminStatusMsg, setAdminStatusMsg] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState("");

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
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Parse code blocks (```lang ... ```)
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="code-block"><code>$1</code></pre>');
    
    // Parse inline code (`code`)
    html = html.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');
    
    // Parse headings
    html = html.replace(/^#\s+(.*?)$/gm, "<h1>$1</h1>");
    html = html.replace(/^##\s+(.*?)$/gm, "<h2>$1</h2>");
    html = html.replace(/^###\s+(.*?)$/gm, "<h3>$1</h3>");
    
    // Parse bold & italic
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    // Parse links [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="preview-link">$1</a>');
    
    // Parse horizontal rules (---)
    html = html.replace(/^---$/gm, "<hr class=\"preview-hr\" />");
    
    // Parse blockquotes (> text) -> Note > is encoded as &gt;
    html = html.replace(/^&gt;\s+(.*?)$/gm, '<blockquote class="preview-blockquote">$1</blockquote>');
    
    // Parse bulleted lists (- or * item)
    html = html.replace(/^[\-\*]\s+(.*?)$/gm, '<li class="preview-li">$1</li>');
    
    const lines = html.split("\n");
    const parsedLines = lines.map(line => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("<h1>") || 
        trimmed.startsWith("<h2>") || 
        trimmed.startsWith("<h3>") || 
        trimmed.startsWith("<pre") || 
        trimmed.startsWith("<code") || 
        trimmed.startsWith("<hr") || 
        trimmed.startsWith("<blockquote") || 
        trimmed.startsWith("<li") ||
        trimmed === ""
      ) {
        return line;
      }
      return `<p class="preview-p">${line}</p>`;
    });
    
    return parsedLines.join("");
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

  const fetchFullArticleContent = async (articleId, priceStr) => {
    try {
      const userEmail = user?.email?.address || user?.id || "anonymous-user";
      const unlockedInfo = unlockedArticles[articleId];
      if (!unlockedInfo) return;

      const expectedAmount = Math.round(parseFloat(priceStr) * 1000000);
      const payload = {
        signature: "circle-authorized",
        value: expectedAmount,
        from: userEmail
      };
      const authHeader = "x402 " + btoa(JSON.stringify(payload));

      const response = await fetch(`${BACKEND_URL}/api/articles/${articleId}`, {
        headers: {
          "Authorization": authHeader
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.content) {
          setArticles(prev => prev.map(art => art.id === articleId ? { ...art, content: data.content } : art));
          setSelectedArticle(prev => prev && prev.id === articleId ? { ...prev, content: data.content } : prev);
          return;
        }
      }
      
      // Fallback
      const localArticles = JSON.parse(localStorage.getItem("papercut_local_articles") || "[]");
      const matched = localArticles.find(la => la.id === articleId);
      if (matched && matched.content) {
        setArticles(prev => prev.map(art => art.id === articleId ? { ...art, content: matched.content } : art));
        setSelectedArticle(prev => prev && prev.id === articleId ? { ...prev, content: matched.content } : prev);
      }
    } catch (err) {
      console.error("Failed to fetch full article content:", err);
      // Fallback
      const localArticles = JSON.parse(localStorage.getItem("papercut_local_articles") || "[]");
      const matched = localArticles.find(la => la.id === articleId);
      if (matched && matched.content) {
        setArticles(prev => prev.map(art => art.id === articleId ? { ...art, content: matched.content } : art));
        setSelectedArticle(prev => prev && prev.id === articleId ? { ...prev, content: matched.content } : prev);
      }
    }
  };

  useEffect(() => {
    if (selectedArticle && unlockedArticles[selectedArticle.id] && !selectedArticle.content) {
      fetchFullArticleContent(selectedArticle.id, selectedArticle.price);
    }
  }, [selectedArticle, unlockedArticles]);

  const fetchArticles = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/articles`);
      let fetchedArticles = [];
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          fetchedArticles = data;
        }
      }
      
      // Merge with INITIAL_ARTICLES first
      const mergedWithInitial = fetchedArticles.map(item => {
        const local = INITIAL_ARTICLES.find(la => la.id === item.id);
        // Only merge if the authors match case-insensitively
        if (local && local.author.toLowerCase() === item.author.toLowerCase()) {
          return {
            ...local,
            ...item
          };
        }
        return item;
      });
      
      // Ensure all INITIAL_ARTICLES are present
      INITIAL_ARTICLES.forEach(la => {
        if (!mergedWithInitial.some(a => a.id === la.id && a.author.toLowerCase() === la.author.toLowerCase())) {
          mergedWithInitial.push(la);
        }
      });
      
      // Load local storage articles
      const localArticles = JSON.parse(localStorage.getItem("papercut_local_articles") || "[]");
      
      // Merge them
      const allArticles = [...mergedWithInitial];
      localArticles.forEach(la => {
        if (!allArticles.some(a => a.id === la.id && a.author.toLowerCase() === la.author.toLowerCase())) {
          allArticles.push(la);
        }
      });
      
      // Sort by ID descending so newest dispatches appear at the top of LATEST DISPATCHES list
      allArticles.sort((a, b) => {
        const idA = parseInt(a.id.replace("local-", "")) || 0;
        const idB = parseInt(b.id.replace("local-", "")) || 0;
        if (idA !== idB) {
          return idB - idA;
        }
        return b.id.localeCompare(a.id);
      });
      
      setArticles(allArticles);
    } catch (err) {
      console.error("Failed to fetch articles:", err);
      // Fallback
      const localArticles = JSON.parse(localStorage.getItem("papercut_local_articles") || "[]");
      const allArticles = [...INITIAL_ARTICLES];
      localArticles.forEach(la => {
        if (!allArticles.some(a => a.id === la.id && a.author.toLowerCase() === la.author.toLowerCase())) {
          allArticles.push(la);
        }
      });
      allArticles.sort((a, b) => {
        const idA = parseInt(a.id.replace("local-", "")) || 0;
        const idB = parseInt(b.id.replace("local-", "")) || 0;
        if (idA !== idB) return idB - idA;
        return b.id.localeCompare(a.id);
      });
      setArticles(allArticles);
    }
  };

  const fetchPublishers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/publishers`);
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
  };

  const getPublisherRecord = (email) => {
    if (!publishers || !email) return null;
    return publishers[email.toLowerCase()] || null;
  };

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
    if (smartWalletAddress || activeWallet?.address || user?.wallet?.address) {
      setPubFormWallet(smartWalletAddress || activeWallet?.address || user?.wallet?.address || "");
    }
  }, [smartWalletAddress, activeWallet, user]);

  const userEmail = user?.email?.address || user?.id || "";

  // Dynamic earnings calculation for verified publishers
  useEffect(() => {
    const pubRecord = getPublisherRecord(userEmail);
    if (isPublisherView && userEmail && pubRecord && pubRecord.verified) {
      const storedClaimed = localStorage.getItem(`papercut_pub_claimed_${userEmail}`);
      
      // Calculate dynamic earnings based on how many dispatches by this author are unlocked by readers
      const authorArticles = articles.filter(a => a.author.toLowerCase() === pubRecord.name.toLowerCase());
      let calculatedEarned = 0.0;
      
      authorArticles.forEach(art => {
        // Calculate unlocked articles revenue
        if (unlockedArticles[art.id]) {
          calculatedEarned += parseFloat(art.price);
        }
      });
      
      const finalClaimed = storedClaimed ? parseFloat(storedClaimed) : 0.0;
      
      setPubEarnings(calculatedEarned);
      setPubClaimed(finalClaimed);
      localStorage.setItem(`papercut_pub_earned_${userEmail}`, calculatedEarned.toString());
      localStorage.setItem(`papercut_pub_claimed_${userEmail}`, finalClaimed.toString());
    }
  }, [isPublisherView, userEmail, publishers, articles, unlockedArticles]);

  const handlePublishArticleSubmit = async (e) => {
    e.preventDefault();
    if (!newArticleTitle || !newArticleContent || !newArticlePrice) {
      setPublishStatusMsg("Please fill in all fields.");
      return;
    }
    
    setIsPublishing(true);
    setPublishStatusMsg("Publishing dispatch to database...");
    
    const publisherRecord = getPublisherRecord(user?.email?.address || "");
    const authorName = publisherRecord ? publisherRecord.name : "Anonymous Publisher";
    const payoutWallet = publisherRecord ? publisherRecord.walletAddress : (smartWalletAddress || activeWallet?.address || user?.wallet?.address || "");

    try {
      const response = await fetch(`${BACKEND_URL}/api/articles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: newArticleTitle,
          content: newArticleContent,
          price: newArticlePrice,
          author: authorName,
          payee: payoutWallet
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to publish article.");
      }
      
      // Save locally to local storage as well
      const newId = data.article?.id || String(Date.now());
      const newLocalArticle = {
        id: newId,
        title: newArticleTitle,
        content: newArticleContent,
        snippet: generateClientSnippet(newArticleContent),
        price: String(parseFloat(newArticlePrice).toFixed(2)),
        author: authorName,
        payee: payoutWallet,
        verified: true
      };
      
      const existingLocal = JSON.parse(localStorage.getItem("papercut_local_articles") || "[]");
      if (!existingLocal.some(a => a.id === newId)) {
        existingLocal.push(newLocalArticle);
        localStorage.setItem("papercut_local_articles", JSON.stringify(existingLocal));
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
      // Fallback
      const fallbackId = "local-" + Date.now();
      const newLocalArticle = {
        id: fallbackId,
        title: newArticleTitle,
        content: newArticleContent,
        snippet: generateClientSnippet(newArticleContent),
        price: String(parseFloat(newArticlePrice).toFixed(2)),
        author: authorName,
        payee: payoutWallet,
        verified: true
      };
      const existingLocal = JSON.parse(localStorage.getItem("papercut_local_articles") || "[]");
      existingLocal.push(newLocalArticle);
      localStorage.setItem("papercut_local_articles", JSON.stringify(existingLocal));
      
      setPublishStatusMsg("Article saved to local draft storage!");
      setNewArticleTitle("");
      setNewArticleContent("");
      await fetchArticles();
      setTimeout(() => {
        setPublisherTab("ledger");
        setPublishStatusMsg("");
      }, 1500);
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

    const publisherRecord = getPublisherRecord(user?.email?.address || "");
    const authorName = publisherRecord ? publisherRecord.name : "";

    // If content is already present (e.g. from local storage), use it
    if (art.content) {
      setEditContent(art.content);
      setEditStatusMsg("");
      return;
    }

    // Otherwise, fetch it from server
    try {
      const rawId = art.id.replace("local-", "");
      const response = await fetch(`${BACKEND_URL}/api/articles/${rawId}?author=${encodeURIComponent(authorName)}`);
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

    // Fallback if not found or server error
    setEditContent(art.snippet || "");
    setEditStatusMsg("");
  };

  const handleEditArticleSubmit = async (e) => {
    e.preventDefault();
    if (!editingArticle || !editTitle || !editContent || !editPrice) {
      setEditStatusMsg("Please fill in all fields.");
      return;
    }

    setIsEditingSubmit(true);
    setEditStatusMsg("Saving updates on server...");

    const publisherRecord = getPublisherRecord(user?.email?.address || "");
    const authorName = publisherRecord ? publisherRecord.name : "Anonymous Publisher";
    const rawId = editingArticle.id.replace("local-", "");

    try {
      const response = await fetch(`${BACKEND_URL}/api/articles/${rawId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          price: editPrice,
          author: authorName
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update article.");
      }

      // Update client-side local storage cache if it exists
      const existingLocal = JSON.parse(localStorage.getItem("papercut_local_articles") || "[]");
      const updatedLocal = existingLocal.map(art => {
        if (art.id === editingArticle.id || art.id === rawId) {
          return {
            ...art,
            title: editTitle,
            content: editContent,
            price: String(parseFloat(editPrice).toFixed(2)),
            snippet: data.article?.snippet || art.snippet
          };
        }
        return art;
      });
      localStorage.setItem("papercut_local_articles", JSON.stringify(updatedLocal));

      setEditStatusMsg("Article updated successfully!");
      
      // If we are currently viewing the updated article, refresh it in the viewer too
      if (selectedArticle && selectedArticle.id === editingArticle.id) {
        setSelectedArticle(prev => ({
          ...prev,
          title: editTitle,
          content: editContent,
          price: String(parseFloat(editPrice).toFixed(2)),
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
      // Fallback update in local storage only
      const existingLocal = JSON.parse(localStorage.getItem("papercut_local_articles") || "[]");
      const updatedLocal = existingLocal.map(art => {
        if (art.id === editingArticle.id) {
          return {
            ...art,
            title: editTitle,
            content: editContent,
            snippet: generateClientSnippet(editContent),
            price: String(parseFloat(editPrice).toFixed(2))
          };
        }
        return art;
      });
      localStorage.setItem("papercut_local_articles", JSON.stringify(updatedLocal));

      setEditStatusMsg("Article updated locally (Server connection failed)!");
      
      if (selectedArticle && selectedArticle.id === editingArticle.id) {
        setSelectedArticle(prev => ({
          ...prev,
          title: editTitle,
          content: editContent,
          snippet: generateClientSnippet(editContent),
          price: String(parseFloat(editPrice).toFixed(2))
        }));
      }

      setTimeout(() => {
        setEditingArticle(null);
        setEditTitle("");
        setEditContent("");
        setEditPrice("");
        setEditStatusMsg("");
      }, 1500);

      await fetchArticles();
    } finally {
      setIsEditingSubmit(false);
    }
  };

  const handleDeleteArticle = async (articleToDelete) => {
    if (!window.confirm(`Are you certain you want to delete the dispatch "${articleToDelete.title}"? This action is permanent.`)) {
      return;
    }

    const publisherRecord = getPublisherRecord(user?.email?.address || "");
    const authorName = publisherRecord ? publisherRecord.name : "Anonymous Publisher";
    const rawId = articleToDelete.id.replace("local-", "");

    try {
      const response = await fetch(`${BACKEND_URL}/api/articles/${rawId}?author=${encodeURIComponent(authorName)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          author: authorName
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete article.");
      }

      // Remove from local storage cache
      const existingLocal = JSON.parse(localStorage.getItem("papercut_local_articles") || "[]");
      const updatedLocal = existingLocal.filter(art => art.id !== articleToDelete.id && art.id !== rawId);
      localStorage.setItem("papercut_local_articles", JSON.stringify(updatedLocal));

      alert("Dispatch deleted successfully.");
      
      // If we are currently viewing the deleted article, clear selectedArticle
      if (selectedArticle && selectedArticle.id === articleToDelete.id) {
        setSelectedArticle(null);
      }

      await fetchArticles();

    } catch (err) {
      console.error("Failed to delete article:", err);
      // Fallback delete from local storage only
      const existingLocal = JSON.parse(localStorage.getItem("papercut_local_articles") || "[]");
      const updatedLocal = existingLocal.filter(art => art.id !== articleToDelete.id);
      localStorage.setItem("papercut_local_articles", JSON.stringify(updatedLocal));

      alert("Dispatch deleted locally (Server connection failed).");
      
      if (selectedArticle && selectedArticle.id === articleToDelete.id) {
        setSelectedArticle(null);
      }

      await fetchArticles();
    }
  };

  const handleApplyPublisherSubmit = async (e) => {
    e.preventDefault();
    setPubFormStatusMsg("Submitting application...");
    try {
      const response = await fetch(`${BACKEND_URL}/api/publishers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: userEmail,
          name: pubFormName,
          domain: pubFormDomain,
          walletAddress: pubFormWallet,
          category: pubFormCategory
        })
      });
      const data = await response.json();
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
    const claimable = pubEarnings - pubClaimed;
    if (claimable <= 0) return;
    setPubClaiming(true);
    setPubClaimSuccess("");
    
    try {
      // Simulate claim txn wait time (1.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newClaimed = pubClaimed + claimable;
      setPubClaimed(newClaimed);
      localStorage.setItem(`papercut_pub_claimed_${userEmail}`, newClaimed.toString());
      setPubClaimSuccess(`Accrued revenue of ${claimable.toFixed(4)} USDC claimed successfully! Funds withdrawn to EVM address: ${shortenAddress(pubFormWallet || smartWalletAddress)}`);
    } catch (err) {
      console.error(err);
      setPubClaimSuccess("Claim execution failed.");
    } finally {
      setPubClaiming(false);
    }
  };

  const handleToggleAdminView = (showAdmin) => {
    setIsAdminView(showAdmin);
    if (!showAdmin) {
      setIsAdminAuthenticated(false);
      setAdminPasswordInput("");
      setAdminPasswordError("");
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

  useEffect(() => {
    fetchArticles();
    fetchPublishers();
  }, []);

  // Check if current IP is authorized admin when entering admin view
  useEffect(() => {
    if (isAdminView && !isAdminAuthenticated) {
      const checkAdminIp = async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/api/admin/check-ip`);
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
  }, [isAdminView, isAdminAuthenticated]);

  const handleToggleVerify = async (email, currentStatus) => {
    setAdminStatusMsg(`Updating verification for ${email}...`);
    try {
      const response = await fetch(`${BACKEND_URL}/api/publishers/verify`, {
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
      const response = await fetch(`${BACKEND_URL}/api/publishers?email=${encodeURIComponent(email)}`, {
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
    try {
      const response = await fetch(`${BACKEND_URL}/api/publishers`, {
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
      const data = await response.json();
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
    if (!authenticated || !user) return;
    if (!circleWallet) {
      setCopyStatus("Initializing wallet...");
      await fetchUserCircleWallet();
      return;
    }
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
      setCopyStatus(`Sync error: ${err.message || String(err)}`);
      setTimeout(() => setCopyStatus("Click address to copy"), 3000);
    }
  };

  const handleRequestFaucet = async () => {
    if (!authenticated || !user) return;
    if (!circleWallet) {
      setFaucetError("Wallet not initialized. Attempting initialization...");
      await fetchUserCircleWallet();
      return;
    }
    setFaucetLoading(true);
    setFaucetSuccess("");
    setFaucetError("");
    setCopyStatus("Requesting faucet...");
    try {
      const userEmail = user.email?.address || user.id || "anonymous-user";
      const response = await fetch(`${BACKEND_URL}/api/user/faucet`, {
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
        setFaucetSuccess("Faucet complete! +0.05 USDC has been credited to your account.");
        setCopyStatus("Faucet complete!");
        setTimeout(() => setCopyStatus("Click address to copy"), 2000);
      } else {
        setFaucetError(data.error || "Faucet claim failed.");
        setCopyStatus("Faucet failed.");
        setTimeout(() => setCopyStatus("Click address to copy"), 3000);
      }
    } catch (err) {
      console.error(err);
      setFaucetError(`Faucet error: ${err.message || String(err)}`);
      setCopyStatus("Faucet failed.");
      setTimeout(() => setCopyStatus("Click address to copy"), 3000);
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

  // Load unlocked states from storage on mount / user change
  useEffect(() => {
    if (authenticated && user) {
      const userEmail = user.email?.address || user.id || "anonymous-user";
      const data = localStorage.getItem(`papercut_unlocked_articles_${userEmail}`);
      if (data) {
        setUnlockedArticles(JSON.parse(data));
      } else {
        setUnlockedArticles({});
      }
    } else {
      setUnlockedArticles({});
    }
  }, [authenticated, user]);

  // Update active wallet chain ID when wallet changes
  useEffect(() => {
    if (wallets && wallets[0]) {
      setChainId(wallets[0].chainId);
    }
  }, [wallets]);

  // Fetch or create user's Circle Programmable Wallet on backend upon login
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
          address: localBackup?.address,
          balance: localBackup?.balance,
          isMock: localBackup?.isMock
        })
      });
      const data = await response.json();
      if (response.ok) {
        const walletData = {
          address: data.address,
          balance: data.balance,
          walletId: data.walletId,
          isMock: data.isMock
        };
        setCircleWallet(walletData);
        localStorage.setItem(`circle_wallet_${userEmail}`, JSON.stringify(walletData));
      } else {
        setError(data.error || "Failed to load Circle MPC wallet.");
      }
    } catch (err) {
      console.error("Error fetching Circle wallet:", err);
      setError(`Error: ${err.message || String(err)} (Backend URL: ${BACKEND_URL || "Relative /api"})`);
    } finally {
      setIsLoadingWallet(false);
    }
  };

  useEffect(() => {
    fetchUserCircleWallet();
  }, [authenticated, user]);

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

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    if (!withdrawAmount || !withdrawAddress) {
      setWithdrawError("Please enter both amount and destination address.");
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

    const userEmail = user?.email?.address || user?.id || "anonymous-user";

    try {
      const response = await fetch(`${BACKEND_URL}/api/user/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: userEmail,
          walletId: circleWallet.walletId,
          address: circleWallet.address,
          destinationAddress: withdrawAddress,
          amount: withdrawAmount
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Withdrawal request failed.");
      }

      setCircleWallet(prev => prev ? { ...prev, balance: data.balance } : null);
      
      // Update local storage backup
      const stored = localStorage.getItem(`circle_wallet_${userEmail}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.balance = data.balance;
          localStorage.setItem(`circle_wallet_${userEmail}`, JSON.stringify(parsed));
        } catch (err) {}
      }

      setWithdrawSuccess(`Success! Withdrew ${amountVal.toFixed(4)} USDC. TxHash: ${shortenAddress(data.txHash)}`);
      setWithdrawAmount("");
      
      // Fetch articles again to sync
      await fetchArticles();

    } catch (err) {
      console.error("Withdrawal failed:", err);
      setWithdrawError(err.message || "Failed to execute withdrawal.");
    } finally {
      setWithdrawLoading(false);
    }
  };

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
          articleId: selectedArticle.id,
          walletId: circleWallet.walletId,
          address: circleWallet.address
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
      localStorage.setItem(`papercut_unlocked_articles_${userEmail}`, JSON.stringify(updatedUnlocked));
      
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
              handleToggleAdminView(false);
              setIsPublisherView(false);
            }}
            title="Return to Front Page / Home"
            style={{ flex: 1, textAlign: 'left' }}
          >
            {isAdminView || isPublisherView ? "← READER VIEW" : "FRONT PAGE"}
          </div>
          <div className="nav-datetime mono-text" style={{ flex: 1, textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-grey)' }}>
            {formatDateTime(currentDate)}
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            {isAdminView && (
              <span 
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
              </span>
            )}
            {!isAdminView && !isPublisherView && (
              <span 
                className={`nav-front-page-btn`}
                onClick={() => {
                  setSelectedArticle(null);
                  setShowApplyForm(false);
                  setIsPublisherView(true);
                  window.location.hash = '/publisher';
                }}
                style={{ marginRight: '16px', color: 'var(--ink-red)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}
                title="Open Publisher Portal"
              >
                [PUBLISHER PORTAL]
              </span>
            )}
            {isPublisherView && (
              <span 
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
              </span>
            )}
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
      {isPublisherView ? (
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
            <button className="btn" onClick={login} style={{ padding: '10px 24px', fontSize: '12px', width: '100%' }}>
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
              Cryptographic Signature Key Required
            </p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setAdminPasswordError("");
              try {
                const response = await fetch(`${BACKEND_URL}/api/admin/authorize-ip`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({ password: adminPasswordInput })
                });
                if (response.ok) {
                  setIsAdminAuthenticated(true);
                  setAdminPasswordError("");
                } else {
                  setAdminPasswordError("INVALID ACCESS PASSKEY");
                }
              } catch (err) {
                console.error("Failed to authorize admin IP:", err);
                // Fallback locally in case backend server is down or has connection issues
                if (adminPasswordInput === "123456A@a") {
                  setIsAdminAuthenticated(true);
                  setAdminPasswordError("");
                } else {
                  setAdminPasswordError("INVALID ACCESS PASSKEY");
                }
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                <label className="mono-text" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--ink-black)' }}>ENTER ACCREDITATION PASSWORD</label>
                <input 
                  type="password"
                  required
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ padding: '10px', border: '1px solid var(--ink-black)', background: 'var(--paper-bg)', fontFamily: 'var(--font-mono)', fontSize: '14px', textAlign: 'center', letterSpacing: '0.2em' }}
                />
              </div>
              <button type="submit" className="btn" style={{ padding: '10px 0', letterSpacing: '0.06em', fontSize: '12px' }}>
                VERIFY CREDENTIALS
              </button>
            </form>

            {adminPasswordError && (
              <div className="mono-text" style={{ marginTop: '16px', fontSize: '11px', color: 'var(--ink-red)', border: '1px dashed var(--ink-red)', padding: '6px', background: 'rgba(186,45,45,0.05)' }}>
                {adminPasswordError}
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

          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
            {/* Left pane: Add Publisher Form */}
            <div className="vintage-form-card" style={{ flex: '1 1 350px', border: '2px solid var(--ink-black)', padding: '24px', backgroundColor: 'var(--paper-accent)', boxShadow: '4px 4px 0 var(--ink-black)', maxWidth: '420px' }}>
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
                  key={`${art.id}-${art.author}`}
                  className={`article-card ${selectedArticle?.id === art.id && selectedArticle?.author.toLowerCase() === art.author.toLowerCase() ? 'active' : ''}`}
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
                  <div className={`card-snippet ${!authenticated ? 'blurred' : ''}`}>{art.snippet || generateClientSnippet(art.content)}</div>
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
                    <div className="rubber-stamp stamp-green clickable-stamp"
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
                    <div 
                      className="content-text premium-unlocked"
                      dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(selectedArticle.content) }}
                    />
                  ) : (
                    <>
                      <div className="content-text-preview" style={{ fontStyle: 'italic', color: 'var(--ink-grey)', marginBottom: '24px', fontSize: '15px', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                        {selectedArticle.snippet || generateClientSnippet(selectedArticle.content)}
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
      )}

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
                    onClick={() => {
                      if (circleWallet?.address) {
                        handleCopyAddress(circleWallet.address);
                      }
                    }}
                    title={circleWallet?.address ? "Click to copy address" : "Wallet not loaded"}
                  >
                    <span className="address-text">
                      {isLoadingWallet ? "LOADING/CREATING WALLET..." : (circleWallet?.address || "NOT INITIALIZED (CLICK SYNC/FAUCET TO RETRY)")}
                    </span>
                    <span className="copy-badge">{circleWallet?.address ? copyStatus : ""}</span>
                  </div>
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
                    {faucetLoading ? "STAMPING TARIFF..." : "CLAIM 0.05 USDC FAUCET"}
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

                <div className="wallet-actions-section" style={{ marginTop: '16px', borderTop: '1px dashed var(--ink-light-grey)', paddingTop: '16px' }}>
                  <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="wallet-id-label" style={{ marginBottom: '2px' }}>USDC WITHDRAWAL TO EVM WALLET</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label className="mono-text" style={{ fontSize: '8px', fontWeight: 'bold', color: 'var(--ink-grey)' }}>DESTINATION ADDRESS</label>
                      <input 
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
                      <label className="mono-text" style={{ fontSize: '8px', fontWeight: 'bold', color: 'var(--ink-grey)' }}>AMOUNT (USDC)</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input 
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
