import { ethers } from "ethers";

/**
 * SERVER-ONLY Ethereum access for donation verification.
 *
 * This module must never be imported by client components: it carries the
 * server RPC configuration. The server never signs transactions — it only
 * reads receipts and events.
 */

let cachedProvider: ethers.JsonRpcProvider | null = null;

/**
 * Sepolia RPC URL resolution:
 * 1. SEPOLIA_RPC_URL (recommended for production: your Alchemy/Infura key).
 * 2. A managed public endpoint as a no-configuration fallback.
 */
function resolveRpcUrl(): string {
  const configured = process.env.SEPOLIA_RPC_URL?.trim();
  if (configured) {
    return configured;
  }
  // Public, keyless Sepolia RPC fallback for demos and local runs.
  return "https://ethereum-sepolia-rpc.publicnode.com";
}

export function getServerProvider(): ethers.JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new ethers.JsonRpcProvider(resolveRpcUrl(), 11155111, {
      staticNetwork: true,
    });
  }
  return cachedProvider;
}
