import { NextRequest, NextResponse } from "next/server";
import { getGuestVisits, getVisitStats, listVisits, parseVisitFilters } from "@/lib/visits-store";

// For the couple only: who's been visiting — the summary, or with
// ?view=visits one filtered page of the visits themselves, or with
// ?view=guest&guest=N every visit by one guest. Gated by the same shared secret as
// the RSVP export and the wishes admin (RSVP_EXPORT_KEY) — unset, it's off.

export async function GET(request: NextRequest) {
  const expected = process.env.RSVP_EXPORT_KEY;
  if (!expected || request.nextUrl.searchParams.get("key") !== expected) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const params = request.nextUrl.searchParams;
  if (params.get("view") === "guest") {
    const guest = await getGuestVisits(Number(params.get("guest")));
    if (!guest) return NextResponse.json({ error: "No such guest." }, { status: 404 });
    return NextResponse.json(guest, { headers: { "Cache-Control": "private, no-store" } });
  }
  const body =
    params.get("view") === "visits"
      ? await listVisits(parseVisitFilters(params), Number(params.get("page")) || 1, params.get("options") === "1")
      : await getVisitStats();
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
