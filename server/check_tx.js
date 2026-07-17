require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) {
  console.error("CIRCLE_API_KEY is not set. Please set it in server/.env");
  process.exit(1);
}
const txId = String(process.argv[2] || "").trim();
if (!/^[a-fA-F0-9-]{20,80}$/.test(txId)) {
  console.error("Usage: node check_tx.js <circle-transaction-id>");
  process.exit(1);
}

async function checkTx() {
  try {
    const response = await fetch(`https://api.circle.com/v1/w3s/transactions/${txId}`, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || `Circle returned HTTP ${response.status}`);
    console.log("Transaction Details:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error(err);
  }
}

checkTx();
