import { NextRequest, NextResponse } from "next/server";
import { listRsvpGuests } from "@/lib/rsvp-store";

// For the couple only: every guest who's replied, a changed answer folded
// into one. Gated by the same shared secret as the RSVP export
// (RSVP_EXPORT_KEY) — unset, it's off.

export async function GET(request: NextRequest) {
  const expected = process.env.RSVP_EXPORT_KEY;
  if (!expected || request.nextUrl.searchParams.get("key") !== expected) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), guests: await listRsvpGuests() },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
