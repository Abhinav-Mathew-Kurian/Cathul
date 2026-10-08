import { NextRequest, NextResponse } from "next/server";
import { getGuestVisits, getVisitStats, listVisits, parseVisitFilters, setVisitorCounted } from "@/lib/visits-store";

// For the couple only: who's been visiting — the summary, or with
// ?view=visits one filtered page of the visits themselves, or with
// ?view=guest&guest=N every visit by one guest; a POST switches one of the
// couple's own devices out of (or back into) the numbers. Gated by the same shared secret as
// the RSVP export and the wishes admin (RSVP_EXPORT_KEY) — unset, it's off.

const ID = /^[0-9a-f-]{36}$/;

function authorized(request: NextRequest) {
  const expected = process.env.RSVP_EXPORT_KEY;
  return !!expected && request.nextUrl.searchParams.get("key") === expected;
}

const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });

export async function POST(request: NextRequest) {
  if (!authorized(request)) return notFound();
  const body = await request.json().catch(() => null);
  const visitor = String(body?.visitor ?? "");
  if (!ID.test(visitor) || typeof body?.counted !== "boolean") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  await setVisitorCounted(visitor, body.counted);
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return notFound();
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
