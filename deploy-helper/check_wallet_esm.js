import { ethers } from "ethers";

async function checkWallet() {
    const provider = new ethers.JsonRpcProvider("https://mantle-sepolia.drpc.org");
    const hardcodedPrivateKey = "0x9bb97517ba3d7fc013c9e7fe7cb03239e8e586ec988238ccc171825d00f8a827";
    const wallet2 = new ethers.Wallet(hardcodedPrivateKey, provider);
    console.log("dRPC PK Address:", wallet2.address);
    let balance2 = await provider.getBalance(wallet2.address);
    console.log("dRPC PK Balance (MNT):", ethers.formatEther(balance2));
}

checkWallet().catch(console.error);
