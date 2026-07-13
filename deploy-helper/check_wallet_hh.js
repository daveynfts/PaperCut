const hre = require("hardhat");

async function main() {
    const mnemonic = "game fat model depend catch false embark busy reason shield fish escape";
    const wallet = hre.ethers.Wallet.fromPhrase(mnemonic);
    console.log("Derived Address:", wallet.address);
    console.log("Private Key:", wallet.privateKey);

    const provider = new hre.ethers.JsonRpcProvider("https://rpc.sepolia.mantle.xyz");
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance (MNT):", hre.ethers.formatEther(balance));
}

main().catch(console.error);
