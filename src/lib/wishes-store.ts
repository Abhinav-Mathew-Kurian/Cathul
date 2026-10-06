import { createHash, randomUUID } from "crypto";
import { appendFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { MongoServerError, type Collection } from "mongodb";
import { getDb } from "./mongo";
import { MAX_PINNED, PAGE_SIZE, SKY_SIZE, type PublicWish, type WishVisibility } from "./wish-rules";

// Wishes live in their own collection, never alongside RSVPs, so the public
// wall can't leak a phone number or an attendance answer even by mistake.
//
// Concurrency, for when several guests post at the same moment:
//   • Inserts are single-document writes — atomic, nothing to clobber.
//   • Duplicates: every wish carries `contentKey` = hash(name, message,
//     visibility) under a UNIQUE index. A double tap, a network retry or the
//     same wish sent from two tabs at once can only ever store one copy —
//     the database rejects the rest, and they're answered with the original.
//   • Pagination is keyset (newest first by createdAt, then id), never
//     offset: "the next page" means "older than the last wish you have", so
//     wishes arriving mid-read can't shift pages, repeat or skip anything.
//   • Rate limiting is one atomic upsert+increment per client per window,
//     so simultaneous requests can't all slip past a read-then-write check.

export type WishSource = "wall" | "rsvp";

type WishDoc = {
  _id: string;
  name: string;
  message: string;
  visibility: WishVisibility;
  hidden: boolean;
  /** Kept in the sky whatever its age. Absent on wishes from before pinning. */
  pinned?: boolean;
  source: WishSource;
  createdAt: Date;
  contentKey: string;
};

/** Everything the couple sees on the admin page. */
export type AdminWish = PublicWish & { visibility: WishVisibility; hidden: boolean; pinned: boolean; source: WishSource };

function toPublic(doc: WishDoc): PublicWish {
  return { id: doc._id, name: doc.name, message: doc.message, createdAt: doc.createdAt.toISOString() };
}

function toAdmin(doc: WishDoc): AdminWish {
  return { ...toPublic(doc), visibility: doc.visibility, hidden: doc.hidden, pinned: !!doc.pinned, source: doc.source };
}

function contentKeyFor(name: string, message: string, visibility: WishVisibility) {
  return createHash("sha256")
    .update(`${name.toLowerCase()}\u0000${message}\u0000${visibility}`)
    .digest("hex");
}

// ── Cursor: "createdAt ms . id", base64url — opaque to the client. ─────────

function encodeCursor(doc: { createdAt: Date; _id: string }) {
  return Buffer.from(`${doc.createdAt.getTime()}.${doc._id}`).toString("base64url");
}

function decodeCursor(cursor: string | null): { at: Date; id: string } | null {
  if (!cursor) return null;
  const [ms, id] = Buffer.from(cursor, "base64url").toString().split(".");
  const at = new Date(Number(ms));
  return id && !Number.isNaN(at.getTime()) ? { at, id } : null;
}

// ── MongoDB ────────────────────────────────────────────────────────────────

let indexesReady: Promise<unknown> | null = null;

/**
 * Reads pass `forWrite: false` and don't wait on the indexes: they already
 * exist after the first deploy, and waiting cost every cold start an extra
 * database round trip before the wall could load. Writes still wait — the
 * unique index is what makes a double send store only one copy.
 */
async function collections({ forWrite = true } = {}) {
  const db = await getDb();
  if (!db) return null;
  const wishes = db.collection<WishDoc>("wishes");
  const rate = db.collection<{ _id: string; count: number; expiresAt: Date }>("wish_rate_limits");
  // Idempotent, and only attempted once per server instance.
  indexesReady ??= Promise.all([
    wishes.createIndex({ contentKey: 1 }, { unique: true }),
    wishes.createIndex({ visibility: 1, hidden: 1, createdAt: -1, _id: -1 }),
    rate.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => {
    indexesReady = null;
    throw error;
  });
  if (forWrite) await indexesReady;
  else indexesReady.catch((error) => console.error("Failed to ensure wish indexes:", error));
  return { wishes, rate };
}

const DUPLICATE_KEY = 11000;

async function insertOnce(wishes: Collection<WishDoc>, doc: WishDoc): Promise<WishDoc> {
  try {
    await wishes.insertOne(doc);
    return doc;
  } catch (error) {
    if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
      const existing = await wishes.findOne({ contentKey: doc.contentKey });
      if (existing) return existing;
    }
    throw error;
  }
}

// ── Local fallback (dev without MONGODB_URI) ───────────────────────────────
// Same JSON Lines approach as RSVPs: one atomic append per wish. A single
// dev server is one process, so a promise chain serializes the
// check-then-append for duplicates, and hide/unhide and pin/unpin are
// appended events.

const DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_FILE = path.join(DATA_DIR, "wishes.jsonl");
let localQueue: Promise<unknown> = Promise.resolve();

type LocalLine =
  | (Omit<WishDoc, "createdAt"> & { createdAt: string })
  | { _id: string; hiddenUpdate: boolean }
  | { _id: string; pinnedUpdate: boolean }
  | { _id: string; deleted: true };

async function readLocal(): Promise<WishDoc[]> {
  let raw = "";
  try {
    raw = await readFile(LOCAL_FILE, "utf-8");
  } catch {
    return [];
  }
  const byId = new Map<string, WishDoc>();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line) as LocalLine;
    if ("hiddenUpdate" in entry) {
      const doc = byId.get(entry._id);
      if (doc) doc.hidden = entry.hiddenUpdate;
    } else if ("pinnedUpdate" in entry) {
      const doc = byId.get(entry._id);
      if (doc) doc.pinned = entry.pinnedUpdate;
    } else if ("deleted" in entry) {
      byId.delete(entry._id);
    } else {
      byId.set(entry._id, { ...entry, createdAt: new Date(entry.createdAt) });
    }
  }
  return [...byId.values()];
}

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = localQueue.then(task, task);
  localQueue = run.catch(() => {});
  return run;
}

const newestFirst = (a: WishDoc, b: WishDoc) =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a._id < b._id ? 1 : a._id > b._id ? -1 : 0);

// ── Public API ─────────────────────────────────────────────────────────────

/** `created` is false when this exact wish already existed (a double send). */
export async function createWish(input: {
  name: string;
  message: string;
  visibility: WishVisibility;
  source: WishSource;
}): Promise<{ wish: PublicWish; created: boolean }> {
  const doc: WishDoc = {
    _id: randomUUID(),
    ...input,
    hidden: false,
    createdAt: new Date(),
    contentKey: contentKeyFor(input.name, input.message, input.visibility),
  };

  const c = await collections();
  if (c) {
    const stored = await insertOnce(c.wishes, doc);
    return { wish: toPublic(stored), created: stored._id === doc._id };
  }

  return serialized(async () => {
    const existing = (await readLocal()).find((w) => w.contentKey === doc.contentKey);
    if (existing) return { wish: toPublic(existing), created: false };
    await mkdir(DATA_DIR, { recursive: true });
    await appendFile(LOCAL_FILE, JSON.stringify(doc) + "\n", "utf-8");
    return { wish: toPublic(doc), created: true };
  });
}

export type WishPage = {
  wishes: PublicWish[];
  nextCursor: string | null;
  /** First page only. */
  total?: number;
  /**
   * First page only: the lanterns for the sky, newest first — the couple's
   * pinned wishes plus the newest ones. Deliberately one plain list: which
   * of them are pinned never leaves the server, so no guest can tell.
   */
  sky?: PublicWish[];
};

/** One page of the public wall, newest first. `total` and `sky` only come with the first page. */
export async function listPublicWishes(cursor: string | null, limit = PAGE_SIZE): Promise<WishPage> {
  const after = decodeCursor(cursor);
  const c = await collections({ forWrite: false });

  let docs: WishDoc[];
  let total: number | undefined;
  let pinned: WishDoc[] | undefined;
  if (c) {
    const visible = { visibility: "public" as const, hidden: false };
    const query = after
      ? { ...visible, $or: [{ createdAt: { $lt: after.at } }, { createdAt: after.at, _id: { $lt: after.id } }] }
      : visible;
    // One extra tells us whether another page exists, without a second query.
    [docs, total, pinned] = await Promise.all([
      c.wishes.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray(),
      after ? Promise.resolve(undefined) : c.wishes.countDocuments(visible),
      after
        ? Promise.resolve(undefined)
        : c.wishes.find({ ...visible, pinned: true }).sort({ createdAt: -1, _id: -1 }).limit(MAX_PINNED).toArray(),
    ]);
  } else {
    const all = (await readLocal()).filter((w) => w.visibility === "public" && !w.hidden).sort(newestFirst);
    total = after ? undefined : all.length;
    pinned = after ? undefined : all.filter((w) => w.pinned).slice(0, MAX_PINNED);
    const start = after
      ? all.findIndex((w) => w.createdAt < after.at || (w.createdAt.getTime() === after.at.getTime() && w._id < after.id))
      : 0;
    docs = start < 0 ? [] : all.slice(start, start + limit + 1);
  }

  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit);
  let sky: WishDoc[] | undefined;
  if (pinned) {
    const pinnedIds = new Set(pinned.map((d) => d._id));
    const newest = page.filter((d) => !pinnedIds.has(d._id)).slice(0, Math.max(0, SKY_SIZE - pinned.length));
    sky = [...pinned, ...newest].sort(newestFirst);
  }
  return {
    wishes: page.map(toPublic),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    ...(total !== undefined && { total }),
    ...(sky && { sky: sky.map(toPublic) }),
  };
}

/**
 * Counts one request against `key`'s budget for the current window and says
 * whether it's still within `max`. A single atomic upsert+increment, so N
 * simultaneous requests get N distinct counts.
 */
export async function withinRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const c = await collections();
  const windowIndex = Math.floor(Date.now() / windowMs);
  const id = `${createHash("sha256").update(key).digest("hex").slice(0, 32)}:${windowIndex}`;
  if (!c) return true;

  const bump = () =>
    c.rate.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((windowIndex + 1) * windowMs) } },
      { upsert: true, returnDocument: "after" }
    );
  let result;
  try {
    result = await bump();
  } catch (error) {
    // Two first-in-window upserts can collide on _id; the retry lands on the
    // document the other one created.
    if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) result = await bump();
    else throw error;
  }
  return (result?.count ?? 1) <= max;
}

/** Every wish — private and hidden ones included — for the couple. */
export async function listAllWishes(): Promise<AdminWish[]> {
  const c = await collections();
  if (c) return (await c.wishes.find().sort({ createdAt: -1, _id: -1 }).limit(5000).toArray()).map(toAdmin);
  return (await readLocal()).sort(newestFirst).map(toAdmin);
}

/** Hiding a wish also unpins it, so a hidden wish never holds one of the pins. */
export async function setWishHidden(id: string, hidden: boolean): Promise<boolean> {
  const c = await collections();
  const set = hidden ? { hidden, pinned: false } : { hidden };
  if (c) return (await c.wishes.updateOne({ _id: id }, { $set: set })).matchedCount === 1;
  return serialized(async () => {
    if (!(await readLocal()).some((w) => w._id === id)) return false;
    let lines = JSON.stringify({ _id: id, hiddenUpdate: hidden }) + "\n";
    if (hidden) lines += JSON.stringify({ _id: id, pinnedUpdate: false }) + "\n";
    await appendFile(LOCAL_FILE, lines, "utf-8");
    return true;
  });
}

export type PinResult = "ok" | "not-found" | "not-public" | "full";

/**
 * Pins a public, shown wish to the sky (or unpins it). At most MAX_PINNED at
 * once; pinning one more answers "full" and changes nothing.
 */
export async function setWishPinned(id: string, pinned: boolean): Promise<PinResult> {
  const c = await collections();
  if (c) {
    const wish = await c.wishes.findOne({ _id: id });
    if (!wish) return "not-found";
    if (pinned && (wish.visibility !== "public" || wish.hidden)) return "not-public";
    if (pinned && !wish.pinned) {
      const count = await c.wishes.countDocuments({ visibility: "public", hidden: false, pinned: true });
      if (count >= MAX_PINNED) return "full";
    }
    await c.wishes.updateOne({ _id: id }, { $set: { pinned } });
    return "ok";
  }
  return serialized(async () => {
    const all = await readLocal();
    const wish = all.find((w) => w._id === id);
    if (!wish) return "not-found";
    if (pinned && (wish.visibility !== "public" || wish.hidden)) return "not-public";
    if (pinned && !wish.pinned && all.filter((w) => w.pinned && w.visibility === "public" && !w.hidden).length >= MAX_PINNED) {
      return "full";
    }
    await appendFile(LOCAL_FILE, JSON.stringify({ _id: id, pinnedUpdate: pinned }) + "\n", "utf-8");
    return "ok";
  });
}

/**
 * Permanently deletes hidden wishes — the one wish `id`, or every hidden one
 * when `id` is null. Only ever hidden ones: a wish has to come off the wall
 * before it can be deleted, so nothing showing can vanish by a stray tap.
 * Answers the ids that were deleted, so the Google Sheet can drop them too.
 */
export async function deleteHiddenWishes(id: string | null): Promise<string[]> {
  const c = await collections();
  if (c) {
    const filter = { ...(id !== null && { _id: id }), hidden: true };
    const ids = (await c.wishes.find(filter, { projection: { _id: 1 } }).toArray()).map((w) => w._id);
    if (ids.length === 0) return [];
    const { deletedCount } = await c.wishes.deleteMany({ _id: { $in: ids }, hidden: true });
    if (deletedCount === ids.length) return ids;
    // One was shown again between the read and the delete: it's still here,
    // so it mustn't leave the sheet either.
    const kept = new Set((await c.wishes.find({ _id: { $in: ids } }, { projection: { _id: 1 } }).toArray()).map((w) => w._id));
    return ids.filter((wishId) => !kept.has(wishId));
  }
  return serialized(async () => {
    const doomed = (await readLocal()).filter((w) => w.hidden && (id === null || w._id === id));
    if (doomed.length) {
      await appendFile(LOCAL_FILE, doomed.map((w) => JSON.stringify({ _id: w._id, deleted: true }) + "\n").join(""), "utf-8");
    }
    return doomed.map((w) => w._id);
  });
}
