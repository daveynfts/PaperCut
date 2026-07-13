import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@openzeppelin/hardhat-upgrades";
import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY || "";

export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    mantleSepolia: {
      url: "https://rpc.sepolia.mantle.xyz",
      accounts: privateKey ? [privateKey] : [],
      timeout: 120000,
    },
    arcTestnet: {
      url: "https://rpc.testnet.arc.network",
      accounts: privateKey ? [privateKey] : [],
      timeout: 120000,
    },
  },
  etherscan: {
    apiKey: {
      mantleSepolia: "xyz",
    },
    customChains: [
      {
        network: "mantleSepolia",
        chainId: 5003,
        urls: {
          apiURL: "https://explorer.sepolia.mantle.xyz/api",
          browserURL: "https://explorer.sepolia.mantle.xyz",
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
};
