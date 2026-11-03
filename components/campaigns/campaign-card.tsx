import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatDeadlineStatic,
  formatEthAmount,
  progressPercent,
} from "@/lib/format";
import type { CampaignSummary } from "@/lib/types";

export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const percent = progressPercent(campaign.raisedWei, campaign.goalWei);
  const deadline = formatDeadlineStatic(campaign.deadline);

  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
      aria-label={campaign.title}
    >
      <Card className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-md">
        <CardHeader className="p-0">
          <div className="relative aspect-[16/9] w-full bg-muted">
            <Image
              src={campaign.imageUrl}
              alt={campaign.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary">{campaign.category}</Badge>
            <span className="text-xs text-muted-foreground">
              Ends {deadline.text}
            </span>
          </div>
          <CardTitle className="text-base leading-snug group-hover:underline">
            {campaign.title}
          </CardTitle>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {campaign.shortDescription}
          </p>
          <div className="mt-auto space-y-2 pt-2">
            <Progress value={percent ?? 0} aria-label={`Progress: ${percent ?? 0}%`} />
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">
                {formatEthAmount(campaign.raisedWei, { maxFractionDigits: 4 })}{" "}
                ETH <span className="text-muted-foreground">raised</span>
              </span>
              <span className="text-muted-foreground">
                of {formatEthAmount(campaign.goalWei, { maxFractionDigits: 2 })} ETH
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-4 py-2 text-xs text-muted-foreground">
          by {campaign.creatorName}
        </CardFooter>
      </Card>
    </Link>
  );
}
