import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CampaignGridSection,
} from "@/components/campaigns/campaign-grid";
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="border-b bg-muted/40">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="flex flex-col items-start gap-6">
            <Badge variant="secondary" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              Sepolia testnet demo
            </Badge>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Transparent crowdfunding, built on the Sepolia testnet
            </h1>
            <p className="max-w-2xl text-muted-foreground sm:text-lg">
              FundChain is a demo of verifiable crowdfunding: campaign totals
              are computed only from donations verified on-chain on Ethereum
              Sepolia. This site uses test ETH, which has no real-world value,
              and all campaign content is demo data.
            </p>
            <Button asChild size="lg" className="hidden sm:flex">
              <Link href="#campaigns">
                Browse campaigns
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="campaigns" className="py-12">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                Campaigns
              </h2>
              <p className="text-sm text-muted-foreground">
                Raised totals start at zero and grow only from verified
                Sepolia donations.
              </p>
            </div>
          </div>
          <CampaignGridSection />
        </div>
      </section>
    </div>
  );
}
