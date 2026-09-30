import { MongoClient, type Db } from "mongodb";

// One MongoClient per server instance, shared by RSVPs and wishes, so both
// ride the same connection pool instead of each opening their own.
let client: MongoClient | null = null;
let connecting: Promise<MongoClient> | null = null;

/**
 * The app's database, or null when MONGODB_URI isn't set (local dev falls
 * back to files under .data/). On Vercel the filesystem is read-only, so a
 * missing URI there is a hard error with the real cause.
 */
export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (process.env.VERCEL) {
      throw new Error("MONGODB_URI is not set for this Vercel environment — add it in Project Settings → Environment Variables.");
    }
    return null;
  }

  if (!client) {
    // Concurrent first requests share one connect() instead of racing to
    // open several clients.
    connecting ??= new MongoClient(uri).connect();
    try {
      client = await connecting;
    } finally {
      connecting = null;
    }
  }
  return client.db(process.env.MONGODB_DB ?? "wedding");
}
