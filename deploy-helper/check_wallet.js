import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY is required in the local .env file");
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://rpc.testnet.arc.network");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Wallet address:", wallet.address);
  console.log("Native balance:", ethers.formatEther(await provider.getBalance(wallet.address)));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
