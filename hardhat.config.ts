// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY    = process.env.DEPLOYER_PRIVATE_KEY || "";
const ARBISCAN_KEY   = process.env.ARBISCAN_API_KEY     || "";

// Un private key válido debe ser de 32 bytes (64 caracteres hexadecimales, o 66 con prefijo '0x')
const isValidKey     = PRIVATE_KEY && (PRIVATE_KEY.length === 66 || PRIVATE_KEY.length === 64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    // ── Testnet ──────────────────────────────────
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: isValidKey ? [PRIVATE_KEY] : [],
    },

    // ── Mainnet ──────────────────────────────────
    arbitrumOne: {
      url: "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts: isValidKey ? [PRIVATE_KEY] : [],
    },

    // ── Local (Hardhat node) ──────────────────────
    hardhat: {
      chainId: 31337,
    },
  },

  // Verificación automática en Arbiscan
  etherscan: {
    apiKey: {
      arbitrumOne:     ARBISCAN_KEY,
      arbitrumSepolia: ARBISCAN_KEY,
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL:     "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io",
        },
      },
    ],
  },
};

export default config;
