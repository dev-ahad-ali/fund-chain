/**
 * Minimal ABI fragments for the deployed CrowdfundingDemo contract.
 * Kept intentionally small: the app only needs donate, the donation event,
 * and the read helpers used by the UI.
 */

export const CROWDFUNDING_DEMO_ABI = [
  "function donate(bytes32 campaignId) payable",
  "event DonationReceived(bytes32 indexed campaignId, address indexed donor, uint256 amount)",
  "function totalRaisedFor(bytes32 campaignId) view returns (uint256)",
  "function contributionFor(bytes32 campaignId, address donor) view returns (uint256)",
  "function totalRaised(bytes32) view returns (uint256)",
  "function contributions(bytes32, address) view returns (uint256)",
  "function owner() view returns (address)",
] as const;

/**
 * Public configuration. NEXT_PUBLIC_* is safe to read in browser code.
 *
 * The contract address is intentionally NOT baked into source code; it is
 * set after the contract has been confirmed on Sepolia.
 */
export function getConfiguredChainId(): number {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  const chainId = raw ? Number.parseInt(raw, 10) : NaN;
  // Default per plan: 11155111 (Sepolia).
  return Number.isInteger(chainId) ? chainId : 11155111;
}

export function getConfiguredContractAddress(): string | null {
  const raw = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim();
  if (!raw || !/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    return null;
  }
  return raw;
}

export function getEtherscanBaseUrl(): string {
  // Sepolia-only demo. Testnet explorer only; never mainnet links.
  return "https://sepolia.etherscan.io";
}

export function getTxExplorerUrl(txHash: string): string {
  return `${getEtherscanBaseUrl()}/tx/${txHash}`;
}

export function getAddressExplorerUrl(address: string): string {
  return `${getEtherscanBaseUrl()}/address/${address}`;
}
