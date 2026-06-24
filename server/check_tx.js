const apiKey = "TEST_API_KEY:3679ee54d8238127ae76124f76e21849:a08f549a93b403bc66ce7f1609cbeab5";
const txId = "c700c56d-1e58-5c81-a504-5739a720cc2d";

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
