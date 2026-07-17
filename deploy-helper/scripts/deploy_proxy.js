import hre from "hardhat";

async function main() {
  const connection = await hre.network.create();
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MNT");

  const SwipeAlphaRegistry = await ethers.getContractFactory("SwipeAlphaRegistry");
  const implementation = await SwipeAlphaRegistry.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  const initializeData = SwipeAlphaRegistry.interface.encodeFunctionData(
    "initialize",
    [deployer.address],
  );
  const TransparentUpgradeableProxy = await ethers.getContractFactory(
    "TransparentUpgradeableProxy",
  );
  const proxy = await TransparentUpgradeableProxy.deploy(
    implementationAddress,
    deployer.address,
    initializeData,
  );
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const registry = SwipeAlphaRegistry.attach(proxyAddress);

  console.log("\nDeployment Complete!");
  console.log("-------------------------------------------------");
  console.log(`Implementation Address (Logic):  ${implementationAddress}`);
  console.log(`Proxy Address (Callable address): ${proxyAddress}`);
  console.log("-------------------------------------------------");

  console.log("\nRegistering initial AI Agents...");
  const tx1 = await registry.registerAgent("DeFi Alpha Pro", "ipfs://QmdPro");
  await tx1.wait();
  console.log("Registered Agent 1: DeFi Alpha Pro");

  const tx2 = await registry.registerAgent("Meme Master", "ipfs://QmMeme");
  await tx2.wait();
  console.log("Registered Agent 2: Meme Master");

  const tx3 = await registry.registerAgent(
    "Stable Yield Optimizer",
    "ipfs://QmYield",
  );
  await tx3.wait();
  console.log("Registered Agent 3: Stable Yield Optimizer");

  console.log("\nPublishing initial AI Signal on-chain...");
  const txSignal = await registry.publishSignal(
    1,
    "VIRTUAL",
    "BUY",
    287000000,
    "Smart Money flow strongly positive (+320k), high volume support.",
  );
  await txSignal.wait();
  console.log("Published initial AI signal for DeFi Alpha Pro!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
