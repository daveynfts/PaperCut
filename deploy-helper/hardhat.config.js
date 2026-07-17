import "dotenv/config";
import { configVariable, defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";

export default defineConfig({
  plugins: [hardhatEthers, hardhatMocha],
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    mantleSepolia: {
      type: "http",
      chainType: "l1",
      url: "https://rpc.sepolia.mantle.xyz",
      accounts: [configVariable("PRIVATE_KEY")],
    },
    arcTestnet: {
      type: "http",
      chainType: "l1",
      url: "https://rpc.testnet.arc.network",
      accounts: [configVariable("PRIVATE_KEY")],
    },
  },
});
