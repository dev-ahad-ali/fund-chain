import mongoose, { Schema, type Model } from "mongoose";

/**
 * Campaign is mock/editorial content stored in MongoDB Atlas.
 * The goal is stored as a wei decimal string — never as a JS float.
 */

export interface CampaignDocument {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  imageUrl: string;
  category: string;
  creatorName: string;
  creatorWallet?: string;
  /** Precise integer wei as a decimal string. */
  goalWei: string;
  deadline: Date;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<CampaignDocument>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9][a-z0-9-]*$/,
    },
    title: { type: String, required: true, trim: true },
    shortDescription: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    creatorName: { type: String, required: true, trim: true },
    creatorWallet: { type: String, trim: true, default: undefined },
    // Store as string to keep precise integer wei beyond JS Number.MAX_SAFE_INTEGER.
    goalWei: {
      type: String,
      required: true,
      match: /^\d+$/,
    },
    deadline: { type: Date, required: true },
    isPublished: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

CampaignSchema.index({ isPublished: 1, createdAt: -1 });

export const Campaign: Model<CampaignDocument> =
  (mongoose.models.Campaign as Model<CampaignDocument>) ??
  mongoose.model<CampaignDocument>("Campaign", CampaignSchema);
