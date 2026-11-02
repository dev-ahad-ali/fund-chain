import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { campaignIdForSlug } from "@/lib/ethers/campaign-id";
import {
  CROWDFUNDING_DEMO_ABI,
  getConfiguredChainId,
  getConfiguredContractAddress,
} from "@/lib/ethers/contract-abi";
import { getServerProvider } from "@/lib/ethers/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Donation, type DonationDocument } from "@/models/Donation";
import { Campaign } from "@/models/Campaign";
import { SEPOLIA_CHAIN_ID } from "@/lib/ethers/browser";

/**
 * POST /api/donations/verify
 * Body: { campaignSlug: string; transactionHash: string }
 *
 * Security model — the browser is never trusted:
 * - Amount, donor address, campaign id, and confirmation status are derived
 *   exclusively from the on-chain receipt and decoded contract event.
 * - The event's campaignId must match the requested campaign's derived id.
 * - Recording is idempotent through the unique transactionHash index.
 */

export type VerifyDonationResponse = {
  ok: boolean;
  state: "verified" | "missing-receipt" | "wrong-network" | "reverted" | "no-event" | "campaign-mismatch" | "not-configured";
  donation?: {
    campaignSlug: string;
    campaignId: string;
    donorAddress: string;
    amountWei: string;
    transactionHash: string;
    blockNumber: number;
    chainId: number;
    createdAt: string;
  };
  message?: string;
};

interface VerifyRequestBody {
  campaignSlug?: unknown;
  transactionHash?: unknown;
}

function serializeDonation(doc: DonationDocument): VerifyDonationResponse["donation"] {
  return {
    campaignSlug: doc.campaignSlug,
    campaignId: doc.campaignId,
    donorAddress: doc.donorAddress,
    amountWei: doc.amountWei,
    transactionHash: doc.transactionHash,
    blockNumber: doc.blockNumber,
    chainId: doc.chainId,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function POST(request: Request): Promise<NextResponse<VerifyDonationResponse>> {
  let body: VerifyRequestBody;
  try {
    body = (await request.json()) as VerifyRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, state: "reverted", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const { campaignSlug, transactionHash } = body;

  // 1. Validate input shape.
  if (
    typeof campaignSlug !== "string" ||
    !/^[a-z0-9][a-z0-9-]*$/.test(campaignSlug)
  ) {
    return NextResponse.json(
      { ok: false, state: "reverted", message: "Invalid campaign slug." },
      { status: 400 },
    );
  }
  if (
    typeof transactionHash !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)
  ) {
    return NextResponse.json(
      { ok: false, state: "reverted", message: "Invalid transaction hash." },
      { status: 400 },
    );
  }
  const normalizedTxHash = transactionHash.toLowerCase();

  const contractAddress = getConfiguredContractAddress();
  if (!contractAddress) {
    return NextResponse.json(
      {
        ok: false,
        state: "not-configured",
        message:
          "Verification is not configured: NEXT_PUBLIC_CONTRACT_ADDRESS is missing or malformed.",
      },
      { status: 503 },
    );
  }

  try {
    await connectToDatabase();

    // 2. Load the campaign.
    const campaign = await Campaign.findOne({
      slug: campaignSlug,
      isPublished: true,
    });
    if (!campaign) {
      return NextResponse.json(
        {
          ok: false,
          state: "reverted",
          message: "Campaign not found.",
        },
        { status: 404 },
      );
    }

    // Existing record short-circuit: idempotent replay.
    const existing = await Donation.findOne({
      transactionHash: normalizedTxHash,
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        state: "verified",
        donation: serializeDonation(existing),
      });
    }

    const provider = getServerProvider();
    const expectedChainId = getConfiguredChainId();
    if (expectedChainId !== SEPOLIA_CHAIN_ID) {
      return NextResponse.json(
        {
          ok: false,
          state: "wrong-network",
          message:
            "Server configured for a chain other than Sepolia; refusing to verify.",
        },
        { status: 503 },
      );
    }

    // 3. Fetch the receipt from Sepolia.
    const receipt =
      await provider.getTransactionReceipt(normalizedTxHash).catch(() => null);

    if (!receipt) {
      // The transaction may still be pending. Tell the caller to retry later.
      return NextResponse.json(
        {
          ok: false,
          state: "missing-receipt",
          message:
            "Transaction receipt not available yet. It may still be pending; retry verification in a few seconds.",
        },
        { status: 202 },
      );
    }

    // 4. Require a successful receipt.
    if (receipt.status !== 1) {
      return NextResponse.json(
        {
          ok: false,
          state: "reverted",
          message: "Transaction reverted on-chain, so no donation was recorded.",
        },
        { status: 200 },
      );
    }

    // 5. Require the configured contract address and the Sepolia chain.
    // The verification provider is statically bound to Sepolia (see
    // getServerProvider). Double-check the live network id and then only
    // accept events emitted by the configured contract (log address check
    // happens in the decode step below).
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
      return NextResponse.json(
        {
          ok: false,
          state: "wrong-network",
          message: "Verification provider did not confirm the Sepolia network; refusing to record this transaction.",
        },
        { status: 500 },
      );
    }

    // 6.-8. Decode the DonationReceived event from the expected contract.
    const iface = new ethers.Interface(CROWDFUNDING_DEMO_ABI);
    const expectedCampaignId = campaignIdForSlug(campaignSlug);
    let donationEvent:
      | {
          campaignId: string;
          donor: string;
          amount: bigint;
        }
      | null = null;

    for (const log of receipt.logs) {
      const topic = log.topics[0];
      if (!topic) {
        continue;
      }
      let parsedLog: ethers.LogDescription | null = null;
      try {
        parsedLog = iface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
      } catch {
        // Not a matching event for this ABI.
        continue;
      }
      if (!parsedLog || parsedLog.name !== "DonationReceived") {
        continue;
      }
      const donor = parsedLog.args.donor;
      const address = (ethers.isAddress(donor) ? donor : null) as string | null;
      const logContract = ethers.getAddress(log.address.toLowerCase());
      const contractPadded = ethers.getAddress(contractAddress);
      if (logContract !== contractPadded || !address) {
        continue;
      }
      donationEvent = {
        campaignId: String(parsedLog.args.campaignId),
        donor: address,
        amount: BigInt(parsedLog.args.amount.toString()),
      };
      break;
    }

    if (!donationEvent) {
      return NextResponse.json(
        {
          ok: false,
          state: "no-event",
          message:
            "No DonationReceived event from the configured contract was found in this transaction.",
        },
        { status: 200 },
      );
    }

    // 7. Match the decoded campaign id to the requested campaign.
    if (
      donationEvent.campaignId.toLowerCase() !==
      expectedCampaignId.toLowerCase()
    ) {
      return NextResponse.json(
        {
          ok: false,
          state: "campaign-mismatch",
          message:
            "This transaction donated to a different campaign; it cannot be recorded here.",
        },
        { status: 200 },
      );
    }

    // 8. Derive donor/amount from the event (already done above).
    // 9. Insert idempotently on the unique transactionHash.
    const donation = await Donation.create({
      campaignSlug,
      campaignId: expectedCampaignId,
      donorAddress: donationEvent.donor.toLowerCase(),
      amountWei: donationEvent.amount.toString(),
      transactionHash: normalizedTxHash,
      blockNumber: Number(receipt.blockNumber),
      chainId: SEPOLIA_CHAIN_ID,
      status: "confirmed",
    });

    return NextResponse.json({
      ok: true,
      state: "verified",
      donation: serializeDonation(
        donation.toObject() as DonationDocument,
      ),
    });
  } catch (error: unknown) {
    // 10. Duplicate insert: return existing record.
    const mongoCode =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (mongoCode === 11000) {
      const existing = await Donation.findOne({
        transactionHash: normalizedTxHash,
      });
      if (existing) {
        return NextResponse.json({
          ok: true,
          state: "verified",
          donation: serializeDonation(existing),
        });
      }
    }

    console.error(
      "[api/donations/verify] failed:",
      error instanceof Error ? error.message : error,
    );
    // 11. Safe, actionable error; never expose RPC credentials or stacks.
    return NextResponse.json(
      {
        ok: false,
        state: "reverted",
        message:
          "Verification could not complete right now. Your transaction may still have succeeded — keep the transaction hash and retry verification.",
      },
      { status: 500 },
    );
  }
}
