import mongoose, { Schema, type Model } from "mongoose";

/**
 * Verified donation records. Rows are inserted only after the server has
 * independently verified the Sepolia transaction receipt and decoded the
 * contract's DonationReceived event. The unique index on transactionHash
 * makes verification idempotent.
 */

export interface DonationDocument {
  campaignSlug: string;
  /** On-chain bytes32 campaign identifier (keccak256 of the slug). */
  campaignId: string;
  /** Normalized (lowercase) donor address from the on-chain event. */
  donorAddress: string;
  /** Precise integer wei as a decimal string. */
  amountWei: string;
  transactionHash: string;
  blockNumber: number;
  chainId: number;
  status: "confirmed";
  createdAt: Date;
  updatedAt: Date;
}

const DonationSchema = new Schema<DonationDocument>(
  {
    campaignSlug: { type: String, required: true, lowercase: true, trim: true },
    campaignId: { type: String, required: true, lowercase: true, trim: true },
    donorAddress: { type: String, required: true, lowercase: true, trim: true },
    amountWei: { type: String, required: true, match: /^\d+$/ },
    transactionHash: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^0x[0-9a-f]{64}$/,
    },
    blockNumber: { type: Number, required: true, min: 0 },
    chainId: { type: Number, required: true, min: 1 },
    status: { type: String, required: true, enum: ["confirmed"] },
  },
  { timestamps: true },
);

DonationSchema.index({ campaignSlug: 1 });
DonationSchema.index({ donorAddress: 1, createdAt: -1 });

export const Donation: Model<DonationDocument> =
  (mongoose.models.Donation as Model<DonationDocument>) ??
  mongoose.model<DonationDocument>("Donation", DonationSchema);
