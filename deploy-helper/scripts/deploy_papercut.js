import "dotenv/config";
import hre from "hardhat";

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
  const publisher = await ethers.deployContract("PaperCutPublisher", [usdcAddress]);
  await publisher.waitForDeployment();

  const vault = await ethers.deployContract("PaperCutRevenueVault", [usdcAddress, platformFeeBps]);
  await vault.waitForDeployment();

  console.log(`PaperCutPublisher: ${await publisher.getAddress()}`);
  console.log(`PaperCutRevenueVault: ${await vault.getAddress()}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
