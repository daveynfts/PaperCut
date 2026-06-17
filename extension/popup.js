document.addEventListener("DOMContentLoaded", () => {
  const addressEl = document.getElementById("wallet-address");
  const balanceEl = document.getElementById("wallet-balance");
  const dailyLimitInput = document.getElementById("daily-limit");
  const spentTodayEl = document.getElementById("spent-today");
  const btnSaveLimit = document.getElementById("btn-save-limit");
  const btnFaucet = document.getElementById("btn-faucet");
  const txListEl = document.getElementById("tx-list");

  let privateKey = null;
  let address = null;
  let balance = 1.00; // Default starter balance
  let dailyLimit = 0.10;
  let spentToday = 0.00;
  let transactions = [];

  // Load wallet & configurations from Chrome storage
  chrome.storage.local.get(["privateKey", "balance", "dailyLimit", "spentToday", "transactions", "lastSpentDate"], (data) => {
    // 1. Setup Wallet
    if (data.privateKey) {
      privateKey = data.privateKey;
      const wallet = new ethers.Wallet(privateKey);
      address = wallet.address;
    } else {
      // Generate a new random wallet
      const wallet = ethers.Wallet.createRandom();
      privateKey = wallet.privateKey;
      address = wallet.address;
      chrome.storage.local.set({ privateKey, balance });
    }

    addressEl.textContent = shortenAddress(address);
    addressEl.title = address;

    // 2. Setup Balance
    if (data.balance !== undefined) {
      balance = data.balance;
    }
    balanceEl.textContent = balance.toFixed(2);

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

  // Faucet simulation (Refills $5.00 USDC for testing)
  btnFaucet.addEventListener("click", () => {
    balance += 5.00;
    chrome.storage.local.set({ balance }, () => {
      balanceEl.textContent = balance.toFixed(2);
      
      // Flash balance gold
      balanceEl.style.color = "#ffffff";
      setTimeout(() => {
        balanceEl.style.color = "#e6b84c";
      }, 500);
    });
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
          <span class="tx-amount">-$${tx.amount.toFixed(2)}</span>
        </div>
      `
      )
      .join("");
  }

  // Listen for storage updates in background (re-renders popup on live readings)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.balance) {
      balance = changes.balance.newValue;
      balanceEl.textContent = balance.toFixed(2);
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
