import { after, NextRequest, NextResponse } from "next/server";
import { appendWishToSheet } from "@/lib/rsvp-sheet";
import { cleanText, MESSAGE_MAX, NAME_MAX, PAGE_SIZE, validateWish, type WishVisibility } from "@/lib/wish-rules";
import { createWish, listPublicWishes, withinRateLimit, type WishPage } from "@/lib/wishes-store";

// ── GET: one page of the public wall, newest first ─────────────────────────
// Cached at the CDN for a few seconds, and served stale while it refreshes,
// so a thousand guests opening the invitation cost the database a handful of
// queries, not a thousand. The stale window is a full day so a guest arriving
// after a quiet spell still gets the wall instantly from the CDN (it refreshes
// in the background for the next one) rather than waiting on a cold function.
// A guest's own new wish never waits on this cache — the page shows it the
// moment it's saved.

const CACHE = "public, max-age=0, s-maxage=10, stale-while-revalidate=86400";

// A tiny in-process layer on top, for bursts that miss the CDN (or hosts
// without one): identical requests within 5s share one database query.
const recent = new Map<string, { at: number; page: Promise<WishPage> }>();

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor");
  const key = cursor ?? "";
  const now = Date.now();
  let hit = recent.get(key);
  if (!hit || now - hit.at > 5000) {
    hit = { at: now, page: listPublicWishes(cursor, PAGE_SIZE) };
    recent.set(key, hit);
    if (recent.size > 200) recent.delete(recent.keys().next().value!);
  }

  try {
    return NextResponse.json(await hit.page, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    recent.delete(key);
    console.error("Failed to list wishes:", error);
    return NextResponse.json({ error: "Could not load wishes right now." }, { status: 500 });
  }
}

// ── POST: leave a wish ─────────────────────────────────────────────────────

const RATE_MAX = 12; // per client per window — generous, since a family on
const RATE_WINDOW_MS = 10 * 60_000; // one Wi-Fi (or a carrier NAT) shares an IP
const MIN_FILL_MS = 1500; // nobody writes a wish faster than this; bots do

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Bots: a filled-in hidden field, or a form "written" in under 1.5s. They
  // get an ordinary-looking success and nothing is stored.
  if (String(body.website ?? "") !== "" || Number(body.elapsedMs ?? 0) < MIN_FILL_MS) {
    return NextResponse.json({ ok: true });
  }

  const visibility: WishVisibility = body.visibility === "private" ? "private" : "public";
  const name = cleanText(body.name, NAME_MAX, false);
  const message = cleanText(body.message, MESSAGE_MAX, true);
  const errors = validateWish({ name, message, visibility });
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: Object.values(errors)[0], fields: errors }, { status: 400 });
  }

  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  try {
    if (!(await withinRateLimit(`wish:${client}`, RATE_MAX, RATE_WINDOW_MS))) {
      return NextResponse.json(
        { error: "That's a lot of love at once! Please wait a few minutes before sending another wish." },
        { status: 429 }
      );
    }
    const { wish, created } = await createWish({ name, message, visibility, source: "wall" });
    // Copied to the Sheet's Wishes tab after answering, and only once — a
    // repeated send of the same wish doesn't add a second row.
    if (created) {
      after(() =>
        appendWishToSheet({ ...wish, visibility, source: "wall" }).catch((error) =>
          console.error("Failed to copy wish to Google Sheet:", error)
        )
      );
    }
    return NextResponse.json({ ok: true, wish: visibility === "public" ? wish : undefined });
  } catch (error) {
    console.error("Failed to save wish:", error);
    return NextResponse.json({ error: "Could not send your wish right now. Please try again." }, { status: 500 });
  }
}
