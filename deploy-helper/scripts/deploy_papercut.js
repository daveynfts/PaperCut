import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  // Mock USDC address on Arc Testnet
  const USDC_ADDRESS = "0x0000000000000000000000000000000000001010"; 

  console.log("USDC Token Address:", USDC_ADDRESS);

  // Get the ContractFactory
  const PaperCutPublisher = await hre.ethers.getContractFactory("PaperCutPublisher");
  
  console.log("Deploying PaperCutPublisher...");
  const contract = await PaperCutPublisher.deploy(USDC_ADDRESS);

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("PaperCutPublisher successfully deployed to:", contractAddress);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
