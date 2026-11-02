import { network } from "hardhat";

/**
 * Deploys CrowdfundingDemo to the selected network.
 *
 * Usage:
 *   npx hardhat compile
 *   npx hardhat keystore set SEPOLIA_RPC_URL           # e.g. https://ethereum-sepolia-rpc.publicnode.com
 *   npx hardhat keystore set SEPOLIA_DEPLOYER_PRIVATE_KEY   # funded Sepolia test account
 *   npx hardhat run scripts/deploy.ts --network sepolia
 *
 * The printed address belongs in NEXT_PUBLIC_CONTRACT_ADDRESS for the web app.
 * Never reuse the deployer account on mainnet and never commit its key.
 */

const { ethers } = await network.create();

console.log("Deploying CrowdfundingDemo...");
const contract = await ethers.deployContract("CrowdfundingDemo");

await contract.waitForDeployment();

const address = await contract.getAddress();
const [deployer] = await ethers.getSigners();

console.log(`Deployed CrowdfundingDemo to: ${address}`);
console.log(`Deployed by: ${deployer.address}`);
console.log(
  "Next step: set NEXT_PUBLIC_CONTRACT_ADDRESS in the web app to the printed address.",
);
