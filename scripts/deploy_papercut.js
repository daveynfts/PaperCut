import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import hre from "hardhat";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connection = await hre.network.create();
  const { ethers, networkName } = connection;
  const [deployer] = await ethers.getSigners();
  const usdcAddress = process.env.USDC_TOKEN_ADDRESS;
  const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || 500);

  if (!usdcAddress || !ethers.isAddress(usdcAddress)) {
    throw new Error("USDC_TOKEN_ADDRESS must be a valid deployed token address");
  }
  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 3000) {
    throw new Error("PLATFORM_FEE_BPS must be an integer between 0 and 3000");
  }

  console.log(`Deploying PaperCut on ${networkName} with ${deployer.address}`);
  console.log(`USDC token: ${usdcAddress}`);

  const publisher = await ethers.deployContract("PaperCutPublisher", [usdcAddress]);
  await publisher.waitForDeployment();
  const publisherAddress = await publisher.getAddress();

  const vault = await ethers.deployContract("PaperCutRevenueVault", [usdcAddress, platformFeeBps]);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  const deploymentsDirectory = path.join(__dirname, "../deployments");
  fs.mkdirSync(deploymentsDirectory, { recursive: true });
  const deployment = {
    network: networkName,
    deployer: deployer.address,
    usdcAddress,
    platformFeeBps,
    PaperCutPublisher: publisherAddress,
    PaperCutRevenueVault: vaultAddress,
    timestamp: new Date().toISOString(),
  };
  const outputPath = path.join(deploymentsDirectory, `${networkName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment saved to ${outputPath}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
