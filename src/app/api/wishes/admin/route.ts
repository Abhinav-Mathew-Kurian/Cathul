import { after, NextRequest, NextResponse } from "next/server";
import { markWishHiddenInSheet } from "@/lib/rsvp-sheet";
import { MAX_PINNED } from "@/lib/wish-rules";
import { listAllWishes, setWishHidden, setWishPinned } from "@/lib/wishes-store";

// For the couple only: every wish (private ones included) and the switches to
// hide or restore a public one, and to pin it to the sky. Gated by the same shared secret as the RSVP
// export (RSVP_EXPORT_KEY) — with no key configured, it's simply off.

function authorized(request: NextRequest) {
  const expected = process.env.RSVP_EXPORT_KEY;
  return !!expected && request.nextUrl.searchParams.get("key") === expected;
}

const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });

export async function GET(request: NextRequest) {
  if (!authorized(request)) return notFound();
  return NextResponse.json(
    { wishes: await listAllWishes() },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return notFound();
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (id && typeof body?.pinned === "boolean") {
    const result = await setWishPinned(id, body.pinned);
    if (result === "not-found") return notFound();
    if (result === "not-public") {
      return NextResponse.json({ error: "Only a public wish that's showing can be pinned." }, { status: 400 });
    }
    if (result === "full") {
      return NextResponse.json(
        { error: `Already ${MAX_PINNED} pinned — unpin one first.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  }
  if (!id || typeof body?.hidden !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const found = await setWishHidden(id, body.hidden);
  if (!found) return notFound();
  after(() =>
    markWishHiddenInSheet(id, body.hidden).catch((error) => console.error("Failed to update wish in Google Sheet:", error))
  );
  return NextResponse.json({ ok: true });
}
