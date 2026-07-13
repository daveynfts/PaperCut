import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Starting deployment of MockMerchantMoeRouter on Mantle Sepolia Testnet...");

  const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.mantle.xyz");
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("Please set PRIVATE_KEY in .env file");
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const currentNonce = await provider.getTransactionCount(wallet.address, "latest");
  console.log(`Current Nonce: ${currentNonce}`);

  // Deploy MockMerchantMoeRouter
  console.log("\nDeploying MockMerchantMoeRouter...");
  const artifactPath = path.join(__dirname, "../artifacts/contracts/MockMerchantMoeRouter.sol/MockMerchantMoeRouter.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  const contract = await factory.deploy({ nonce: currentNonce });
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log(`\n✅ MockMerchantMoeRouter deployed to: ${address}`);
}

main().catch(console.error);
