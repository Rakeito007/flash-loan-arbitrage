require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable IR-based code generation to handle stack too deep
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66 
        ? [process.env.PRIVATE_KEY] 
        : [],
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "https://eth.llamarpc.com",
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66 
        ? [process.env.PRIVATE_KEY] 
        : [],
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66 
        ? [process.env.PRIVATE_KEY] 
        : [],
      chainId: 8453,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66 
        ? [process.env.PRIVATE_KEY] 
        : [],
      chainId: 84532,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
