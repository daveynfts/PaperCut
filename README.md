# PaperCut 📄✂️

**PaperCut** is an end-to-end RSS Reader and Chrome Extension designed to highlight Circle's EIP-3009 gasless nanopayments on the Arc L1 blockchain. It unbundles premium content, allowing readers to buy individual articles (e.g., $0.02 USDC) instantly and automatically without traditional subscription paywalls.

## 🚀 Key Value Propositions

1. **Unbundling Subscriptions**: Don't force users to buy a $40/month subscription for one article. Let them pay $0.02 USDC to read it instantly.
2. **Zero-Friction UX (Auto-Signing)**: The extension signs EIP-3009 transactions off-chain based on a customizable daily budget limit. No metamask popups on every click!
3. **Gasless Arc L1 Settlement**: Relays the user-authorized EIP-3009 signature directly to Circle's Arc Gateway, bypassing transaction gas fees entirely.
4. **Clean Web2-Like Experience**: Zero setup fee, zero transaction delay (<500ms settlement verification off-chain).

---

## 📁 System Architecture

```
PaperCut/
├── extension/          # Chrome Extension V3 (Local Ephemeral Wallet & EIP-3009 Signer)
│   ├── manifest.json
│   ├── popup.html      # Wallet dashboard, Faucet simulator, settings
│   ├── popup.js
│   └── background.js   # Intercepts x402 challenges, handles signing
├── reader/             # RSS Feed Frontend UI (Glassmorphic Reader View)
│   ├── index.html
│   ├── index.css
│   └── reader.js       # Handles 402 redirects and connects to extension
└── server/             # Publisher Backend
    └── server.js       # Verifies EIP-3009 signatures and mock-relays to Arc
```

---

## 🛠️ Installation & Setup

### 1. Run the Backend Server
Make sure you have Node.js installed, then run:
```bash
npm install
npm start
```
The server will run on `http://localhost:4000`.

### 2. Load the Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top-right corner).
3. Click **Load unpacked** (top-left).
4. Select the `extension/` directory.
5. Copy the generated **Extension ID**.
6. Open the extension popup from the toolbar and click **Faucet** to get `$5.00 USDC` to play with.

### 3. Open the Web Reader UI
1. Open `reader/index.html` in Chrome.
2. Paste the **Extension ID** you copied into the input box in the navbar and click **Connect**.
3. Choose a premium article on the left pane and click **Unlock Article**. Enjoy reading!
