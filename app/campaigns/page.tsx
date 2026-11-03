import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CampaignListRow,
  CampaignListSkeleton,
} from "@/components/campaigns/campaign-list";
import { getPublishedCampaigns } from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "All campaigns",
  description:
    "Browse every FundChain campaign — transparent totals from verified Sepolia donations.",
};

/**
 * List view of all published campaigns (loads from MongoDB at request time;
 * served from the cache and revalidated by the verification API).
 *
 * With Cache Components, the uncached read lives inside <Suspense>.
 */

async function CampaignList() {
  const campaigns = await getPublishedCampaigns();

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        No campaigns are published yet. Please check back soon.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {campaigns.map((campaign) => (
        <CampaignListRow key={campaign.slug} campaign={campaign} />
      ))}
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          All campaigns
        </h1>
        <p className="text-sm text-muted-foreground">
          Raised totals start at zero and grow only from verified Sepolia
          donations. Campaign content is demo data.
        </p>
      </div>
      <Suspense fallback={<CampaignListSkeleton />}>
        <CampaignList />
      </Suspense>
    </div>
  );
}
