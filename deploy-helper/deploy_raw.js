import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Starting deployment on Mantle Sepolia Testnet...");

  const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.mantle.xyz");
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("Please set PRIVATE_KEY in .env file");
  const wallet = new ethers.Wallet(privateKey, provider);
  
  let currentNonce = await provider.getTransactionCount(wallet.address, "latest");
  console.log(`Current Nonce: ${currentNonce}`);

  // 1. Deploy DaveyTestToken
  console.log("\nDeploying $DAVEYTEST Token...");
  const tokenArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, "artifacts/contracts/DaveyTestToken.sol/DaveyTest.json"), "utf8"));
  const tokenFactory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, wallet);
  const token = await tokenFactory.deploy({ nonce: currentNonce++ });
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`✅ Token deployed to: ${tokenAddress}`);

  // 2. Deploy Staking Contract
  console.log("\nDeploying Staking Contract...");
  const stakingArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, "artifacts/contracts/Staking.sol/Staking.json"), "utf8"));
  const stakingFactory = new ethers.ContractFactory(stakingArtifact.abi, stakingArtifact.bytecode, wallet);
  const staking = await stakingFactory.deploy(tokenAddress, { nonce: currentNonce++ });
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log(`✅ Staking Contract deployed to: ${stakingAddress}`);

  // 3. Fund Staking Contract with Rewards
  console.log("\nFunding Staking Contract with 5000 $DAVEYTEST for rewards...");
  const fundAmount = ethers.parseEther("5000"); // Half the supply for rewards
  const tx = await token.transfer(stakingAddress, fundAmount, { nonce: currentNonce++ });
  await tx.wait();
  console.log(`✅ Funded Staking contract with 5000 tokens!`);

  console.log("\n🎉 Deployment Complete!");
  console.log("-------------------------------------------------");
  console.log(`Copy these values to your React App src/constants.js:`);
  console.log(`TOKEN_ADDRESS = "${tokenAddress}"`);
  console.log(`STAKING_ADDRESS = "${stakingAddress}"`);
  console.log("-------------------------------------------------");
  
  // Auto-update React App constants.js
  const constantsPath = path.join(__dirname, "../mantle-staking-dapp/src/constants.js");
  if (fs.existsSync(constantsPath)) {
    let content = fs.readFileSync(constantsPath, "utf8");
    content = content.replace(/export const TOKEN_ADDRESS = ".*";/, `export const TOKEN_ADDRESS = "${tokenAddress}";`);
    content = content.replace(/export const STAKING_ADDRESS = ".*";/, `export const STAKING_ADDRESS = "${stakingAddress}";`);
    fs.writeFileSync(constantsPath, content);
    console.log("✨ Auto-updated src/constants.js in the React App!");
  }
}

main().catch(console.error);
