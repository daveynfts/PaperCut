import { ethers } from "ethers";

async function test() {
  const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.mantle.xyz");
  const TOKEN_ADDRESS = "0x2880D31c613a8c2F3216064765b0C1E4d3D375A6";
  const STAKING_ADDRESS = "0x251615574BFD224450147B1eE815F0cc28Cc8D6d";
  
  const TOKEN_ABI = [
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];
  
  const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);
  
  try {
    const filter = tokenContract.filters.Transfer(null, STAKING_ADDRESS);
    const currentBlock = await provider.getBlockNumber();
    console.log("Current block:", currentBlock);
    const fromBlock = currentBlock > 5000 ? currentBlock - 5000 : 0;
    
    console.log(`Querying from ${fromBlock} to ${currentBlock}`);
    const events = await tokenContract.queryFilter(filter, fromBlock, currentBlock);
    console.log("Events:", events.length);
    
    if (events.length > 0) {
      console.log("First event args:", events[0].args);
      console.log("First event from:", events[0].args[0]);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
