import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const networkName = hre.network.name;
  console.log("Current network:", networkName);

  // Network-aware USDC addresses
  const USDC_ADDRESSES = {
    localhost: "0x0000000000000000000000000000000000001010",
    hardhat: "0x0000000000000000000000000000000000001010",
    amoy: "0x41E94EB019C0762f9Bfcf9Fb1E58725BfB0e7582", // Polygon Amoy USDC
    polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Polygon Mainnet USDC
    sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Ethereum Sepolia USDC
    mainnet: "0xA0b86991c6218b36c1d19d4a2e9Eb0ce3606eb48" // Ethereum Mainnet USDC
  };

  const usdcAddress = USDC_ADDRESSES[networkName];

  if (!usdcAddress) {
    throw new Error(`No USDC address configured for network: ${networkName}`);
  }

  // Network validation safety checks
  if (networkName === "mainnet" || networkName === "polygon") {
    console.log("=============================================");
    console.log("WARNING: Deploying to a PRODUCTION network!");
    console.log("Target USDC Address:", usdcAddress);
    console.log("=============================================");
  }

  console.log(`USDC Token Address used: ${usdcAddress}`);

  // 1. Deploy PaperCutPublisher
  const PaperCutPublisher = await hre.ethers.getContractFactory("PaperCutPublisher");
  console.log("Deploying PaperCutPublisher...");
  const publisher = await PaperCutPublisher.deploy(usdcAddress);
  await publisher.waitForDeployment();
  const publisherAddress = await publisher.getAddress();
  console.log("PaperCutPublisher deployed to:", publisherAddress);

  // 2. Deploy PaperCutRevenueVault (with 5% platform fee)
  const PaperCutRevenueVault = await hre.ethers.getContractFactory("PaperCutRevenueVault");
  console.log("Deploying PaperCutRevenueVault...");
  const platformFeeBps = 500; // 5%
  const vault = await PaperCutRevenueVault.deploy(usdcAddress, platformFeeBps);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("PaperCutRevenueVault deployed to:", vaultAddress);

  // Save deployment artifacts
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentData = {
    network: networkName,
    deployer: deployer.address,
    usdcAddress,
    PaperCutPublisher: publisherAddress,
    PaperCutRevenueVault: vaultAddress,
    timestamp: new Date().toISOString()
  };

  const deploymentPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log(`Deployment details saved to: ${deploymentPath}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
