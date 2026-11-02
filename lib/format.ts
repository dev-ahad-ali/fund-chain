import { formatEther, parseEther } from "ethers";

/**
 * Display helpers. All blockchain amounts are handled as wei strings/bigints —
 * never JS floating-point numbers.
 */

const WEI_DECIMALS = 18;

/** Parse an ETH amount string; returns null when invalid. */
export function parseEthAmount(value: string): bigint | null {
  try {
    const parsed = parseEther(value.trim());
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

/** Convert wei (decimal string or bigint) to a display ETH string. */
export function formatEthAmount(
  wei: string | bigint,
  options: { maxFractionDigits?: number } = {},
): string {
  const weiBig = typeof wei === "bigint" ? wei : BigInt(wei);
  const value = formatEther(weiBig);
  if (options.maxFractionDigits === undefined) {
    return value;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: options.maxFractionDigits,
  });
}

/** Percentage of goal reached, clamped 0-100. Returns null when goal is zero. */
export function progressPercent(
  raisedWei: string,
  goalWei: string,
): number | null {
  const goal = BigInt(goalWei);
  if (goal <= 0n) return null;
  const raised = BigInt(raisedWei);
  const pct = (raised * 100n) / goal;
  return pct > 100n ? 100 : Number(pct);
}

/** Shorten an Ethereum address, e.g. 0x1234…abcd. */
export function shortenAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Shorten a transaction hash for display. */
export function shortenTxHash(hash: string): string {
  if (hash.length < 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

/** Format a deadline date; flags whether it is in the past. */
export function formatDeadline(iso: string): { text: string; ended: boolean } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { text: "—", ended: false };
  }
  const now = new Date();
  const ended = date.getTime() < now.getTime();
  const text = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return { text, ended };
}

export const WEI_DECIMAL_COUNT = WEI_DECIMALS;
