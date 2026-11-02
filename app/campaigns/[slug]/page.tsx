import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Shapes,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DonationPanel } from "@/components/campaigns/donation-panel";
import { getPublishedCampaignBySlug } from "@/lib/campaigns";
import {
  formatEthAmount,
  formatDeadline,
  progressPercent,
} from "@/lib/format";

/**
 * Milestone 1 shell for the campaign detail page.
 * Milestone 2 swaps the data layer for MongoDB reads.
 */

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr,minmax(0px,380px)]">
      <Skeleton className="aspect-[16/9] w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

async function CampaignDetail({
  params,
}: {
  params: PageProps<"/campaigns/[slug]">["params"];
}) {
  const { slug } = await params;
  const campaign = await getPublishedCampaignBySlug(slug);

  if (!campaign) {
    notFound();
  }

  const percent = progressPercent(campaign.raisedWei, campaign.goalWei);
  const deadline = formatDeadline(campaign.deadline);

  return (
    <article className="grid gap-8 lg:grid-cols-[minmax(0px,1fr),minmax(0px,380px)]">
      <div className="space-y-6">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
          <Image
            src={campaign.imageUrl}
            alt={campaign.title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-cover"
          />
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {campaign.title}
          </h1>
          <p className="text-muted-foreground">{campaign.shortDescription}</p>
          <Separator />
          <div className="space-y-2 text-sm leading-7 text-muted-foreground">
            {campaign.description}
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-4 rounded-xl border p-4 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" aria-hidden />
            <div>
              <dt className="text-muted-foreground">Creator</dt>
              <dd className="font-medium">{campaign.creatorName}</dd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
            <div>
              <dt className="text-muted-foreground">Deadline</dt>
              <dd className="font-medium">
                {deadline.ended ? `${deadline.text} (ended)` : deadline.text}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shapes className="h-4 w-4 text-muted-foreground" aria-hidden />
            <div>
              <dt className="text-muted-foreground">Category</dt>
              <dd className="font-medium">{campaign.category}</dd>
            </div>
          </div>
        </dl>
      </div>

      <aside className="space-y-4 top-24 self-start lg:sticky">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-lg font-semibold">
                  {formatEthAmount(campaign.raisedWei, {
                    maxFractionDigits: 4,
                  })}{" "}
                  ETH <span className="text-sm font-normal text-muted-foreground">raised</span>
                </span>
                <span className="text-muted-foreground">
                  {formatEthAmount(campaign.goalWei, {
                    maxFractionDigits: 2,
                  })}{" "}
                  ETH goal
                </span>
              </div>
              <Progress value={percent ?? 0} aria-label={`Progress: ${percent ?? 0}%`} />
              <p className="text-xs text-muted-foreground">
                {campaign.donationCount} verified donor
                {campaign.donationCount === 1 ? "" : "s"} · totals include only
                on-chain verified donations
              </p>
            </div>
            <DonationPanel
              campaignSlug={campaign.slug}
              campaignTitle={campaign.title}
            />
            <p className="text-xs text-muted-foreground">
              Donations are live Sepolia transactions. Test ETH has no
              real-world value and cannot be withdrawn or refunded through this
              demo.
            </p>
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">On-chain verified totals</Badge>
          <Badge variant="outline">Demo content</Badge>
        </div>
      </aside>
    </article>
  );
}

export default async function CampaignDetailPage({
  params,
}: PageProps<"/campaigns/[slug]">) {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2 text-muted-foreground"
      >
        <Link href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All campaigns
        </Link>
      </Button>
      {/* params is a dynamic read under Cache Components, so the parts of
          the page that need it (including the DB fetch) sit inside Suspense. */}
      <Suspense fallback={<DetailSkeleton />}>
        <CampaignDetail params={params} />
      </Suspense>
    </div>
  );
}
