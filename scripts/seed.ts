import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { Campaign } from "@/models/Campaign";
import {
  demoCampaigns,
} from "@/lib/demo-data";

/**
 * Idempotent seed script: upserts demo campaign content by slug.
 *
 * Usage:
 *   npm run seed
 *
 * Requires MONGODB_URI in .env.local (or the environment). The script
 * inserts only campaign content — it never creates fake donation records,
 * and existing Donation documents are never touched.
 *
 * Run repeatedly (or in CI) without duplicating data: reads are upserts.
 */

// Minimal .env.local loader (dotenv-style) so `npm run seed` works without
// extra dependencies; real environment variables always take precedence.
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (key && !(key in process.env)) {
      const value = raw?.replace(/^["']|["']$/g, "") ?? "";
      process.env[key] = value;
    }
  }
} catch {
  // No .env.local file; rely on the actual environment.
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error(
    "MONGODB_URI is not set. Add it to .env.local: MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/fundchain",
  );
  process.exit(1);
}

async function seed(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  console.log(
    `[seed] connected (db: ${mongoose.connection.name ?? "unknown"})`,
  );

  let upserted = 0;
  let unchanged = 0;

  for (const campaign of demoCampaigns) {
    const result = await Campaign.updateOne(
      { slug: campaign.slug },
      {
        // $setOnInsert keeps seed data from clobbering manual edits, while
        // guaranteeing the columns exist for first-time setups.
        $setOnInsert: {
          slug: campaign.slug,
          title: campaign.title,
          shortDescription: campaign.shortDescription,
          description: campaign.description,
          imageUrl: campaign.imageUrl,
          category: campaign.category,
          creatorName: campaign.creatorName,
          goalWei: campaign.goalWei,
          deadline: new Date(campaign.deadline),
          isPublished: true,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      upserted += 1;
      console.log(`[seed] inserted: ${campaign.slug}`);
    } else {
      unchanged += 1;
    }
  }

  const campaignCount = await Campaign.countDocuments();
  const donationCount = await mongoose.connection.collection("donations").countDocuments();

  console.log(
    `[seed] done — ${upserted} inserted, ${unchanged} already present; campaigns: ${campaignCount}, donations: ${donationCount} (donations are only ever created by on-chain verification)`,
  );
}

seed()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(
      "[seed] failed:",
      error instanceof Error ? error.message : error,
    );
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
