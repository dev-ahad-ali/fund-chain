"use client";

import { BrowserProvider } from "ethers";

/**
 * Browser-side EIP-1193 typed helpers.
 *
 * Server-only code (RPC URLs, Mongo) must never be imported here — the
 * wallet talks to the user's injected provider (MetaMask) only.
 */

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/** Sepolia chain constants (the only chain this demo supports). */
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

export type ChainMetadata = {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

/**
 * Keyless, public Sepolia metadata used only for `wallet_addEthereumChain`
 * when the user's wallet does not know the chain. No API keys belong here.
 */
export const SEPOLIA_CHAIN_METADATA: ChainMetadata = {
  chainId: SEPOLIA_CHAIN_ID_HEX,
  chainName: "Sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

export function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

/** Lazily-create an ethers BrowserProvider bound to the injected wallet. */
export function getBrowserProvider(): BrowserProvider {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error(
      "No MetaMask provider found in this browser. Install MetaMask to continue.",
    );
  }
  // "any" lets us interact with whatever chain the wallet currently uses;
  // network validation is handled by the wallet context.
  return new BrowserProvider(provider, "any");
}

export function isProviderMetaMask(provider: Eip1193Provider): boolean {
  return provider.isMetaMask === true;
}

/** EIP-1193 error codes we explicitly handle in the UI. */
export const EIP1193_ERROR_CODES = {
  USER_REJECTED: 4001,
  CHAIN_NOT_ADDED: 4902,
  UNAUTHORIZED: -32002,
} as const;
