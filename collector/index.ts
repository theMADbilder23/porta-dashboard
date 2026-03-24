import fetch from "node-fetch";

const DEBANK_API_KEY = process.env.DEBANK_API_KEY;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

async function fetchDeBankData() {
  try {
    const res = await fetch(
      `https://pro-openapi.debank.com/v1/user/total_balance?id=${WALLET_ADDRESS}`,
      {
        headers: {
          AccessKey: DEBANK_API_KEY || "",
        },
      }
    );

    const data = await res.json();
    console.log("DeBank Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error fetching DeBank:", err);
  }
}

// Run every 60 seconds (we’ll optimize later)
setInterval(() => {
  console.log("Running Porta Collector...");
  fetchDeBankData();
}, 60000);

// Run immediately on start
fetchDeBankData();