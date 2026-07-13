require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) {
  console.error("CIRCLE_API_KEY is not set. Please set it in server/.env");
  process.exit(1);
}
const txId = process.argv[2] || "c700c56d-1e58-5c81-a504-5739a720cc2d";

async function checkTx() {
  try {
    const response = await fetch(`https://api.circle.com/v1/w3s/transactions/${txId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    const json = await response.json();
    console.log("Transaction Details:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error(err);
  }
}

checkTx();
