import { NextResponse } from "next/server";
import { getPublishedCampaigns } from "@/lib/campaigns";

export async function GET() {
  try {
    const campaigns = await getPublishedCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error: unknown) {
    // Log server-side without secrets; return a safe message.
    console.error(
      "[api/campaigns] failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Failed to load campaigns. Please try again later." },
      { status: 500 },
    );
  }
}
