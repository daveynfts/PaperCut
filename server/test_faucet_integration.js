const path = require("path");
// Ensure environment variables are loaded for the test
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = require("./server.js");

async function runIntegrationTest() {
  const PORT = 4005;
  const server = app.listen(PORT, async () => {
    console.log(`Test server listening on port ${PORT}`);
    
    const email = "daveynfts@gmail.com";
    try {
      // 1. Get/Create User Wallet
      console.log("-> Posting to /api/user/wallet");
      const walletRes = await fetch(`http://localhost:${PORT}/api/user/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const walletData = await walletRes.json();
      console.log("Wallet Data:", walletData);
      
      if (!walletRes.ok) {
        console.error("Wallet endpoint returned status:", walletRes.status);
        server.close();
        return;
      }
      
      // 2. Request Faucet Claim
      console.log("-> Posting to /api/user/faucet");
      const faucetRes = await fetch(`http://localhost:${PORT}/api/user/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          walletId: walletData.walletId,
          address: walletData.address
        })
      });
      const faucetData = await faucetRes.json();
      console.log("Faucet Data:", faucetData);
      
    } catch (err) {
      console.error("Test execution failed:", err);
    } finally {
      server.close(() => {
        console.log("Test server stopped.");
      });
    }
  });
}

runIntegrationTest();
