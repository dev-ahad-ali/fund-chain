import { connection } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Campaign, type CampaignDocument } from "@/models/Campaign";
import { Donation } from "@/models/Donation";
import type { CampaignSummary, CampaignView } from "@/lib/types";

/**
 * Campaign data access for server components, backed by MongoDB Atlas.
 *
 * Source-of-truth rules:
 * - Campaign content (title, descriptions, goal, deadline, ...) comes from
 *   the Campaign collection.
 * - Raised totals come only from verified Donation records; they are joined
 *   here and are never seeded or mocked.
 *
 * `await connection()` opts reads out of build-time prerendering (Cache
 * Components) so totals are computed at request time.
 */

function toCampaignView(doc: CampaignDocument): CampaignView {
  return {
    slug: doc.slug,
    title: doc.title,
    shortDescription: doc.shortDescription,
    description: doc.description,
    imageUrl: doc.imageUrl,
    category: doc.category,
    creatorName: doc.creatorName,
    creatorWallet: doc.creatorWallet,
    goalWei: doc.goalWei,
    deadline: doc.deadline.toISOString(),
  };
}

/** Sum verified donations per campaign slug using exact bigint wei math. */
async function getVerifiedTotalsBySlug(): Promise<Map<string, {
  raisedWei: string;
  donationCount: number;
}>> {
  const totals = new Map<string, { raisedWei: string; donationCount: number }>();
  const donations = await Donation.find(
    { status: "confirmed" as const },
    { campaignSlug: 1, amountWei: 1 },
  )
    .lean<{ campaignSlug: string; amountWei: string }[]>()
    .exec();

  for (const donation of donations) {
    const current = totals.get(donation.campaignSlug) ?? {
      raisedWei: "0",
      donationCount: 0,
    };
    let sum: bigint;
    try {
      sum = BigInt(current.raisedWei) + BigInt(donation.amountWei);
    } catch {
      // Ignore malformed stored values rather than corrupting the total.
      sum = BigInt(current.raisedWei);
    }
    totals.set(donation.campaignSlug, {
      raisedWei: sum.toString(),
      donationCount: current.donationCount + 1,
    });
  }

  return totals;
}

function withVerifiedTotals(
  campaign: CampaignDocument,
  totals: Map<string, { raisedWei: string; donationCount: number }>,
): CampaignSummary {
  const total = totals.get(campaign.slug) ?? {
    raisedWei: "0",
    donationCount: 0,
  };
  return {
    ...toCampaignView(campaign),
    raisedWei: total.raisedWei,
    donationCount: total.donationCount,
  };
}

export async function getPublishedCampaigns(): Promise<
  CampaignSummary[]
> {
  await connection();
  await connectToDatabase();

  const [campaigns, totals] = await Promise.all([
    Campaign.find({ isPublished: true }).sort({ createdAt: -1 }).exec(),
    getVerifiedTotalsBySlug(),
  ]);

  return campaigns.map((campaign) => withVerifiedTotals(campaign, totals));
}

export async function getPublishedCampaignBySlug(
  rawSlug: string,
): Promise<CampaignSummary | null> {
  await connection();
  await connectToDatabase();

  // Slugs are stored lowercase; reject anything that is not a valid slug
  // shape instead of querying free-form strings.
  const slug = rawSlug.toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return null;
  }

  const [campaign, totals] = await Promise.all([
    Campaign.findOne({ slug, isPublished: true }).exec(),
    // Reuse the shared totals join; small dataset keeps this simple.
    getVerifiedTotalsBySlug(),
  ]);

  return campaign ? withVerifiedTotals(campaign, totals) : null;
}
