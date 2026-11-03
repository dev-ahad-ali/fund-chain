import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

/**
 * Hardhat 3 configuration for the FundChain demo contract.
 *
 * Sepolia secrets ("SEPOLIA_RPC_URL", "SEPOLIA_DEPLOYER_PRIVATE_KEY") are
 * resolved in this order by Hardhat:
 *   1. Real environment variables (shell, CI, or `contracts/.env.local`).
 *      Example: SEPOLIA_RPC_URL=... SEPOLIA_DEPLOYER_PRIVATE_KEY=... \
 *        npx hardhat run scripts/deploy.ts --network sepolia
 *   2. The Hardhat keystore (`npx hardhat keystore set SEPOLIA_RPC_URL`).
 *
 * Never commit these values. The deployer key must belong to a throwaway,
 * testnet-only account funded with Sepolia ETH.
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
