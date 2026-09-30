import { NextRequest, NextResponse } from "next/server";
import { listAllWishes, setWishHidden } from "@/lib/wishes-store";

// For the couple only: every wish (private ones included) and the switch to
// hide or restore a public one. Gated by the same shared secret as the RSVP
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
  if (!id || typeof body?.hidden !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const found = await setWishHidden(id, body.hidden);
  return found ? NextResponse.json({ ok: true }) : notFound();
}
