import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MNT");

  const SwipeAlphaRegistry = await hre.ethers.getContractFactory("SwipeAlphaRegistry");
  console.log("\nDeploying SwipeAlphaRegistry (Transparent Proxy)...");
  
  // Deploy the transparent proxy, passing the deployer as initialOwner
  const proxy = await hre.upgrades.deployProxy(SwipeAlphaRegistry, [deployer.address], {
    initializer: "initialize",
    kind: "transparent",
  });
  
  await proxy.waitForDeployment();
  
  const proxyAddress = await proxy.getAddress();
  const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  const adminAddress = await hre.upgrades.erc1967.getAdminAddress(proxyAddress);

  console.log("\n🎉 Deployment Complete!");
  console.log("-------------------------------------------------");
  console.log(`Proxy Admin Address:             ${adminAddress}`);
  console.log(`Implementation Address (Logic):  ${implementationAddress}`);
  console.log(`Proxy Address (Callable address): ${proxyAddress}`);
  console.log("-------------------------------------------------");
  
  console.log("\nRegistering initial AI Agents...");
  // Register the 3 initial agents in the registry for mockup sync
  const tx1 = await proxy.registerAgent("DeFi Alpha Pro", "ipfs://QmdPro");
  await tx1.wait();
  console.log("✅ Registered Agent 1: DeFi Alpha Pro");

  const tx2 = await proxy.registerAgent("Meme Master", "ipfs://QmMeme");
  await tx2.wait();
  console.log("✅ Registered Agent 2: Meme Master");

  const tx3 = await proxy.registerAgent("Stable Yield Optimizer", "ipfs://QmYield");
  await tx3.wait();
  console.log("✅ Registered Agent 3: Stable Yield Optimizer");

  console.log("\nPublishing initial AI Signal on-chain...");
  // Satisfies the "At least one AI-powered function is callable on-chain" requirement
  const txSignal = await proxy.publishSignal(
    1, // DeFi Alpha Pro
    "VIRTUAL",
    "BUY",
    287000000, // $2.87 scaled by 1e8
    "Smart Money flow strongly positive (+320k), high volume support."
  );
  await txSignal.wait();
  console.log("✅ Published initial AI signal for DeFi Alpha Pro!");
  
  console.log("\nReady for integration!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
