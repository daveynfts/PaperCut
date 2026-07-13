const { ethers } = require("ethers");

async function checkWallet() {
    const mnemonic = "game fat model depend catch false embark busy reason shield fish escape";
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    console.log("Derived Address:", wallet.address);
    console.log("Private Key:", wallet.privateKey);

    const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.mantle.xyz");
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance (MNT):", ethers.formatEther(balance));
}

checkWallet().catch(console.error);
