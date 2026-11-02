import mongoose from "mongoose";

/**
 * Reusable MongoDB (Atlas) connection helper.
 *
 * The mongoose connection promise is cached on `globalThis` so hot reloads
 * and serverless invocations (e.g. Vercel) reuse the same connection instead
 * of opening a new one per request.
 */

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  __fundChainMongoose?: MongooseCache;
};

function getConnectionString(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add the MongoDB Atlas connection string to .env.local (local development) or to your Vercel environment variables. Example: mongodb+srv://<user>:<password>@<cluster>.mongodb.net/fundchain",
    );
  }
  return uri;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  const cached = globalForMongoose.__fundChainMongoose ?? {
    conn: null,
    promise: null,
  };
  globalForMongoose.__fundChainMongoose = cached;

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const uri = getConnectionString();
    // Mongoose 9 keeps sensible defaults; connect options are minimal on purpose.
    cached.promise = mongoose
      .connect(uri)
      .then((mongooseInstance) => {
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[mongodb] connected (db: ${mongooseInstance.connection.name ?? "unknown"})`,
          );
        }
        return mongooseInstance;
      })
      .catch((error: unknown) => {
        // Do not cache a failed connection promise.
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown MongoDB error";
    throw new Error(
      `Failed to connect to MongoDB Atlas: ${message}. Check that MONGODB_URI is correct and that your current IP is allowed in Atlas network access.`,
    );
  }

  return cached.conn;
}
