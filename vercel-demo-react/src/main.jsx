import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { PrivyProvider } from '@privy-io/react-auth'

// Default Demo App ID from Privy for testing, or user can replace with their own from dashboard.privy.io
const PRIVY_APP_ID = "clqh45d0c00t2mc0f6u7q08g9"; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['google', 'email', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#e6b84c',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
)
