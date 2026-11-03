import { Suspense } from "react";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPublishedCampaigns,
} from "@/lib/campaigns";

/**
 * Server component that reads campaign data at request time.
 * With Cache Components enabled, uncached reads must run inside a
 * <Suspense> boundary so the static shell can stream in.
 */

function CampaignGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="aspect-[16/9] w-full rounded-xl" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export async function CampaignGrid() {
  // Cached via `use cache` in lib/campaigns.ts: the prerendered shell
  // includes the grid, so navigating back to "/" is instant.
  const campaigns = await getPublishedCampaigns();

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        No campaigns are published yet. Please check back soon.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.slug} campaign={campaign} />
      ))}
    </div>
  );
}

export function CampaignGridSection() {
  return (
    <Suspense fallback={<CampaignGridSkeleton />}>
      <CampaignGrid />
    </Suspense>
  );
}
