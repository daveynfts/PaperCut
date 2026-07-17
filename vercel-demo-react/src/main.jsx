import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { PrivyProvider } from '@privy-io/react-auth'

// Define Arc Testnet as a custom EVM chain in Privy
const arcTestnet = {
  id: 5042002,
  network: 'arc-testnet',
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
    public: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
};

import logoImg from './assets/logo.png'

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;
if (!PRIVY_APP_ID) {
  throw new Error('VITE_PRIVY_APP_ID is required');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // 1. Lock Privy strictly to Arc Testnet
        supportedChains: [arcTestnet],
        defaultChain: arcTestnet,
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#8f2d1b',
          logo: logoImg,
          showWalletLoginFirst: false,
          landingHeader: 'Sign the Guest Register',
          loginMessage: 'Log in with your cryptographic wallet or electronic mail to unlock dispatch files.',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        }
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
)
