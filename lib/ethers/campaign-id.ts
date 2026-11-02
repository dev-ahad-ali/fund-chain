import { id as computeId } from "ethers";

/**
 * Contract-facing campaign identifiers.
 *
 * The on-chain bytes32 campaign id is derived deterministically from the
 * stable MongoDB slug so the browser, server, and contract agree on the same
 * key. Changing a campaign's slug changes its on-chain identity — slugs are
 * therefore considered immutable once published.
 */

export function campaignIdForSlug(slug: string): string {
  return computeId(slug);
}
