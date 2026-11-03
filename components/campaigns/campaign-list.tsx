import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDeadlineStatic,
  formatEthAmount,
  progressPercent,
  shortenAddress,
} from "@/lib/format";
import type { CampaignSummary } from "@/lib/types";

/**
 * Compact list view (rows) of all published campaigns — an alternative to
 * the homepage card grid, designed for scanning many campaigns at once.
 */

export function CampaignListRow({
  campaign,
}: {
  campaign: CampaignSummary;
}) {
  const percent = progressPercent(campaign.raisedWei, campaign.goalWei);
  const deadline = formatDeadlineStatic(campaign.deadline);
  const creator = campaign.creatorWallet
    ? shortenAddress(campaign.creatorWallet)
    : campaign.creatorName;

  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
      aria-label={campaign.title}
    >
      <div className="flex flex-col gap-4 rounded-lg border p-4 transition-colors hover:bg-accent sm:flex-row sm:items-center sm:gap-6">
        <div className="relative h-[72px] w-28 shrink-0 overflow-hidden rounded-md bg-muted sm:h-20 sm:w-32">
          <Image
            src={campaign.imageUrl}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {campaign.category}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Ends {deadline.text} · by {creator}
            </span>
          </div>
          <h3 className="truncate text-base font-semibold tracking-tight group-hover:underline">
            {campaign.title}
          </h3>
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {campaign.shortDescription}
          </p>
        </div>

        <div className="w-full shrink-0 space-y-1 sm:w-52">
          <Progress value={percent ?? 0} aria-label={`Progress: ${percent ?? 0}%`} />
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium">
              {formatEthAmount(campaign.raisedWei, { maxFractionDigits: 4 })} ETH
            </span>
            <span className="text-muted-foreground">
              of {formatEthAmount(campaign.goalWei, { maxFractionDigits: 2 })} ETH
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {campaign.donationCount} verified donor
            {campaign.donationCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function CampaignListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-6"
        >
          <Skeleton className="h-[72px] w-full shrink-0 rounded-md sm:h-20 sm:w-32" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
          <div className="w-full shrink-0 space-y-2 sm:w-52">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
