import { NextRequest, NextResponse } from "next/server";
import { getVisitStats, listVisits, parseVisitFilters } from "@/lib/visits-store";

// For the couple only: who's been visiting — the summary, or with
// ?view=visits one filtered page of the visits themselves. Gated by the same shared secret as
// the RSVP export and the wishes admin (RSVP_EXPORT_KEY) — unset, it's off.

export async function GET(request: NextRequest) {
  const expected = process.env.RSVP_EXPORT_KEY;
  if (!expected || request.nextUrl.searchParams.get("key") !== expected) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const params = request.nextUrl.searchParams;
  const body =
    params.get("view") === "visits"
      ? await listVisits(parseVisitFilters(params), Number(params.get("page")) || 1, params.get("options") === "1")
      : await getVisitStats();
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
