/**
 * Shared view-model types used across server and client components.
 * Amounts use wei decimal strings; never JavaScript floats for blockchain values.
 */

export type CampaignView = {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  imageUrl: string;
  category: string;
  creatorName: string;
  creatorWallet?: string;
  /** Goal amount in wei as a decimal integer string. */
  goalWei: string;
  /** ISO date string. */
  deadline: string;
};

export type CampaignSummary = CampaignView & {
  /** Verified raised amount in wei, as a decimal integer string. */
  raisedWei: string;
  /** Number of verified on-chain donations. */
  donationCount: number;
};

export type VerifiedDonation = {
  campaignSlug: string;
  campaignId: string;
  donorAddress: string;
  amountWei: string;
  transactionHash: string;
  blockNumber: number;
  chainId: number;
  status: "confirmed";
  createdAt: string;
};
