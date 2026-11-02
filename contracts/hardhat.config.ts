import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

/**
 * Hardhat 3 configuration for the FundChain demo contract.
 *
 * Secrets are provided via the Hardhat keystore (`npx hardhat keystore set`),
 * never committed to source control:
 *
 *   SEPOLIA_RPC_URL            — JSON-RPC endpoint for the Sepolia network
 *   SEPOLIA_DEPLOYER_PRIVATE_KEY — funded testnet-only deployer account
 */
export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.30",
      },
      production: {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    // Local unit-test network (in-memory).
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },
    // Sepolia testnet only. Never point this network at mainnet.
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_DEPLOYER_PRIVATE_KEY")],
    },
  },
});
