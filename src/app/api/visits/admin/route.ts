import { NextRequest, NextResponse } from "next/server";
import { getVisitStats } from "@/lib/visits-store";

// For the couple only: who's been visiting. Gated by the same shared secret as
// the RSVP export and the wishes admin (RSVP_EXPORT_KEY) — unset, it's off.

export async function GET(request: NextRequest) {
  const expected = process.env.RSVP_EXPORT_KEY;
  if (!expected || request.nextUrl.searchParams.get("key") !== expected) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json(await getVisitStats(), { headers: { "Cache-Control": "private, no-store" } });
}
