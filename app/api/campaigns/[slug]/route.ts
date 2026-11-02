import { NextResponse } from "next/server";
import { getPublishedCampaignBySlug } from "@/lib/campaigns";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const campaign = await getPublishedCampaignBySlug(slug);
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ campaign });
  } catch (error: unknown) {
    console.error(
      "[api/campaigns/[slug]] failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Failed to load campaign. Please try again later." },
      { status: 500 },
    );
  }
}
