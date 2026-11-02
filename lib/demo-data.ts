import type { CampaignView } from "@/lib/types";

/**
 * Temporary typed campaign data used before MongoDB is connected
 * (Milestone 1). Replaced by `lib/campaigns.ts` database reads (Milestone 2).
 */

const DAY = 24 * 60 * 60 * 1000;

function futureDeadline(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * DAY).toISOString();
}

export const demoCampaigns: CampaignView[] = [
  {
    slug: "community-library-renovation",
    title: "Community Library Renovation",
    shortDescription:
      "Repair the reading hall, add seating for 80 students, and start a lending program.",
    description:
      "The Oakfield community library has served the neighborhood for 30 years, but the reading hall is leaking and the children's section is closed. This campaign funds structural repairs, new shelving, seating for 80 students, and the launch of a free lending program. Funds are tracked on-chain so anyone can verify the totals raised.",
    imageUrl:
      "https://images.unsplash.com/photo-1521586773954-13d0e07b86a6?w=1200&q=80&auto=format&fit=crop",
    category: "Education",
    creatorName: "Oakfield Library Trust",
    goalWei: "5000000000000000000",
    deadline: futureDeadline(45),
  },
  {
    slug: "clean-water-rural",
    title: "Clean Water for Rural Communities",
    shortDescription:
      "Install three solar-powered wells for villages without reliable drinking water.",
    description:
      "Over 4,000 residents across three villages rely on a river that runs dry for months each year. This campaign funds three solar-powered borehole wells with community-managed maintenance training. Every donation is recorded on the Sepolia testnet so progress can be audited by anyone.",
    imageUrl:
      "https://images.unsplash.com/photo-1461204835731-9d0a6f29e4d6?w=1200&q=80&auto=format&fit=crop",
    category: "Environment",
    creatorName: "WellSpring Collective",
    goalWei: "8000000000000000000",
    deadline: futureDeadline(60),
  },
  {
    slug: "open-source-education-lab",
    title: "Open-Source Education Lab",
    shortDescription:
      "Equip a community lab with refurbished computers and free software training.",
    description:
      "A donation-funded lab where students learn programming and digital skills on refurbished hardware running fully open-source software. The campaign covers 20 workstations, networking equipment, a projector, and stipends for volunteer instructors during the first year.",
    imageUrl:
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80&auto=format&fit=crop",
    category: "Education",
    creatorName: "ByteWorks Academy",
    goalWei: "3500000000000000000",
    deadline: futureDeadline(30),
  },
  {
    slug: "neighborhood-solar-project",
    title: "Neighborhood Solar Project",
    shortDescription:
      "Rooftop solar panels for a community center to cut energy bills by 60%.",
    description:
      "The Elm Street community center pays more for electricity monthly than it spends on program supplies. Installing a 15kW rooftop solar array would cut energy costs by an estimated 60%, freeing funds for free after-school programs. Savings are documented publicly every quarter.",
    imageUrl:
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1200&q=80&auto=format&fit=crop",
    category: "Environment",
    creatorName: "Elm Street Neighbors",
    goalWei: "6500000000000000000",
    deadline: futureDeadline(75),
  },
  {
    slug: "local-food-bank-expansion",
    title: "Local Food Bank Expansion",
    shortDescription:
      "Add cold storage and a second distribution day to reach 500 more families.",
    description:
      "The downtown food bank turns away families every week because it lacks refrigerated storage for fresh produce and dairy. This campaign funds commercial cold storage, a delivery van for pickup partners, and a second weekly distribution day expected to reach 500 additional households.",
    imageUrl:
      "https://images.unsplash.com/photo-1593113598332-cd2884764a7e?w=1200&q=80&auto=format&fit=crop",
    category: "Community",
    creatorName: "Downtown Food Bank",
    goalWei: "4200000000000000000",
    deadline: futureDeadline(90),
  },
];

export function getDemoPublishedCampaigns(): CampaignView[] {
  return [...demoCampaigns];
}

export function getDemoPublishedCampaign(
  slug: string,
): CampaignView | undefined {
  return demoCampaigns.find((campaign) => campaign.slug === slug);
}
