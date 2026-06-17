document.addEventListener("DOMContentLoaded", () => {
  const addressEl = document.getElementById("wallet-address");
  const balanceEl = document.getElementById("wallet-balance");
  const dailyLimitInput = document.getElementById("daily-limit");
  const spentTodayEl = document.getElementById("spent-today");
  const btnSaveLimit = document.getElementById("btn-save-limit");
  const btnSync = document.getElementById("btn-sync");
  const txListEl = document.getElementById("tx-list");

  // New elements
  const emailInput = document.getElementById("user-email");
  const btnSaveEmail = document.getElementById("btn-save-email");
  const emailStatusEl = document.getElementById("email-status");

  let email = null;
  let address = null;
  let balance = 0.00;
  let dailyLimit = 0.10;
  let spentToday = 0.00;
  let transactions = [];

  // Helper to fetch wallet info from backend
  async function fetchWalletDetails(emailVal) {
    if (!emailVal) return;
    try {
      emailStatusEl.textContent = "Syncing wallet info...";
      emailStatusEl.style.color = "#e6b84c";

      const response = await fetch("http://localhost:4000/api/user/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: emailVal })
      });
      const data = await response.json();
      if (response.ok) {
        address = data.address;
        balance = parseFloat(data.balance);
        
        await new Promise(resolve => {
          chrome.storage.local.set({
            email: emailVal,
            circleAddress: address,
            circleBalance: balance
          }, resolve);
        });

        addressEl.textContent = shortenAddress(address);
        addressEl.title = address;
        balanceEl.textContent = balance.toFixed(4);
        emailStatusEl.textContent = "Connected with Circle!";
        emailStatusEl.style.color = "#2ecc71";
      } else {
        emailStatusEl.textContent = data.error || "Failed to sync wallet.";
        emailStatusEl.style.color = "#e74c3c";
      }
    } catch (err) {
      console.error(err);
      emailStatusEl.textContent = "Backend offline (Check port 4000).";
      emailStatusEl.style.color = "#e74c3c";
    }
  }

  // Load wallet & configurations from Chrome storage
  chrome.storage.local.get(["email", "circleAddress", "circleBalance", "dailyLimit", "spentToday", "transactions", "lastSpentDate"], (data) => {
    // 1. Setup Email Connection
    if (data.email) {
      email = data.email;
      emailInput.value = email;
      fetchWalletDetails(email);
    } else {
      addressEl.textContent = "Not Connected";
      emailStatusEl.textContent = "Enter your Gmail to connect.";
    }

    // 2. Setup Address & Balance from storage cache
    if (data.circleAddress) {
      address = data.circleAddress;
      addressEl.textContent = shortenAddress(address);
      addressEl.title = address;
    }
    if (data.circleBalance !== undefined) {
      balance = data.circleBalance;
      balanceEl.textContent = balance.toFixed(4);
    }

    // 3. Setup Daily Limit
    if (data.dailyLimit !== undefined) {
      dailyLimit = data.dailyLimit;
    }
    dailyLimitInput.value = dailyLimit.toFixed(2);

    // 4. Setup Daily spent cap (Reset if new day)
    const today = new Date().toDateString();
    if (data.lastSpentDate === today) {
      if (data.spentToday !== undefined) {
        spentToday = data.spentToday;
      }
    } else {
      spentToday = 0.00;
      chrome.storage.local.set({ spentToday, lastSpentDate: today });
    }
    spentTodayEl.textContent = `${spentToday.toFixed(2)} USDC`;

    // 5. Setup Transactions List
    if (data.transactions) {
      transactions = data.transactions;
      renderTransactions();
    }
  });

  // Shorten Address (e.g. 0x1234...abcd)
  function shortenAddress(addr) {
    if (!addr) return "Not Connected";
    return addr.substring(0, 8) + "..." + addr.substring(addr.length - 8);
  }

  // Copy Address to clipboard
  addressEl.addEventListener("click", () => {
    if (address) {
      navigator.clipboard.writeText(address).then(() => {
        const originalText = addressEl.textContent;
        addressEl.textContent = "Copied Address!";
        addressEl.style.color = "#e6b84c";
        setTimeout(() => {
          addressEl.textContent = originalText;
          addressEl.style.color = "#f0f0f0";
        }, 1500);
      });
    }
  });

  // Save Email Connection
  btnSaveEmail.addEventListener("click", () => {
    const enteredEmail = emailInput.value.trim();
    if (enteredEmail) {
      email = enteredEmail;
      fetchWalletDetails(email);
    } else {
      emailStatusEl.textContent = "Please enter a valid email.";
      emailStatusEl.style.color = "#e74c3c";
    }
  });

  // Save Daily Limit
  btnSaveLimit.addEventListener("click", () => {
    const limit = parseFloat(dailyLimitInput.value);
    if (!isNaN(limit) && limit > 0) {
      dailyLimit = limit;
      chrome.storage.local.set({ dailyLimit }, () => {
        btnSaveLimit.textContent = "Saved";
        setTimeout(() => {
          btnSaveLimit.textContent = "Save";
        }, 1200);
      });
    }
  });

  // Sync wallet details manually
  btnSync.addEventListener("click", () => {
    if (email) {
      fetchWalletDetails(email);
    } else {
      emailStatusEl.textContent = "Connect Gmail first.";
      emailStatusEl.style.color = "#e74c3c";
    }
  });

  // Render recent readings in HTML list
  function renderTransactions() {
    if (transactions.length === 0) {
      txListEl.innerHTML = `<div style="font-size: 10px; color: var(--g600); text-align: center; padding: 10px 0;">No articles read yet.</div>`;
      return;
    }

    txListEl.innerHTML = transactions
      .slice(-4) // Show only the 4 most recent
      .reverse()
      .map(
        (tx) => `
        <div class="tx-item">
          <span class="tx-title" title="${tx.title}">${tx.title}</span>
          <span class="tx-amount">-$${tx.amount.toFixed(4)}</span>
        </div>
      `
      )
      .join("");
  }

  // Listen for storage updates in background (re-renders popup on live readings)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.circleBalance) {
      balance = changes.circleBalance.newValue;
      balanceEl.textContent = balance.toFixed(4);
    }
    if (changes.spentToday) {
      spentToday = changes.spentToday.newValue;
      spentTodayEl.textContent = `${spentToday.toFixed(2)} USDC`;
    }
    if (changes.transactions) {
      transactions = changes.transactions.newValue;
      renderTransactions();
    }
  });
});
