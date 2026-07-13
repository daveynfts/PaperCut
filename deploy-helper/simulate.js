import { ethers } from "ethers";
import dotenv from 'dotenv';

dotenv.config();

async function simulate() {
  const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.mantle.xyz");
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("Please set PRIVATE_KEY in .env file");
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const TOKEN_ADDRESS = "0x2880D31c613a8c2F3216064765b0C1E4d3D375A6";
  const STAKING_ADDRESS = "0x251615574BFD224450147B1eE815F0cc28Cc8D6d";
  
  const TOKEN_ABI = [
    "function allowance(address, address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)"
  ];
  const STAKING_ABI = [
    "function stake(uint256 _amount)"
  ];
  
  const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, wallet);
  const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, wallet);
  
  try {
    const amountWei = ethers.parseEther("10");
    const allowance = await token.allowance(wallet.address, STAKING_ADDRESS);
    console.log("Current allowance:", allowance.toString());
    
    if (allowance < amountWei) {
      console.log("Needs approval...");
      // We won't actually send approve, we just want to see if gas estimation for stake fails
    }
    
    console.log("Estimating gas for stake...");
    const gasLimit = await staking.stake.estimateGas(amountWei);
    console.log("Estimated gas:", gasLimit.toString());
  } catch (e) {
    console.error("Simulation failed:", e);
  }
}

simulate();
