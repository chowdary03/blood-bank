require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Only use the private key if it looks like a valid 64-char hex string.
// This lets `npm run node` work even when .env has placeholder values.
const RAW_KEY = process.env.PRIVATE_KEY || "";
const PRIVATE_KEY = /^[0-9a-fA-F]{64}$/.test(RAW_KEY) ? `0x${RAW_KEY}` : null;
const SEPOLIA_ACCOUNTS = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const ALCHEMY_SEPOLIA_URL = process.env.ALCHEMY_SEPOLIA_URL || "https://eth-sepolia.g.alchemy.com/v2/demo";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: ALCHEMY_SEPOLIA_URL,
      accounts: SEPOLIA_ACCOUNTS,
      chainId: 11155111,
    },
  },

  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    ignition: "./ignition",
  },
};
