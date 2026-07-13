import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("No PRIVATE_KEY found in .env");
    return;
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("Wallet address:", wallet.address);

  try {
    const balance = await provider.getBalance(wallet.address);
    console.log("Native balance:", ethers.formatEther(balance), "USDC");
  } catch (error) {
    console.error("Failed to fetch balance from RPC:", error.message);
  }
}

main().catch(console.error);
