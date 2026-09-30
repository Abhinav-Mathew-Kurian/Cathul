import { after, NextRequest, NextResponse } from "next/server";
import { appendRsvpToSheet } from "@/lib/rsvp-sheet";
import { exportRsvpsAsCsv, saveRsvp, type RsvpEntry } from "@/lib/rsvp-store";
import { cleanText, MESSAGE_MAX, NAME_MAX, validateWish } from "@/lib/wish-rules";
import { createWish } from "@/lib/wishes-store";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const name = String(body.name ?? "").trim().slice(0, 120);
  const phone = String(body.phone ?? "").trim().slice(0, 30);
  const attending = body.attending === "yes" || body.attending === "no" ? body.attending : null;
  const events = Array.isArray(body.events)
    ? body.events.map((e: unknown) => String(e)).slice(0, 10)
    : [];
  const message = String(body.message ?? "").trim().slice(0, 500);

  // Never trust client-side validation alone — re-check everything server-side.
  // Phone is optional.
  if (!name || !attending) {
    return NextResponse.json(
      { error: "Name and attendance are required." },
      { status: 400 }
    );
  }
  if (attending === "yes" && events.length === 0) {
    return NextResponse.json(
      { error: "Please select at least one event." },
      { status: 400 }
    );
  }

  const entry: RsvpEntry = {
    name,
    phone,
    attending,
    events,
    message,
    submittedAt: new Date().toISOString(),
  };

  try {
    await saveRsvp(entry);
  } catch (error) {
    console.error("Failed to save RSVP:", error);
    return NextResponse.json({ error: "Could not save your RSVP right now." }, { status: 500 });
  }

  // The guest opted to also put their message on the public Wishes wall.
  // Best effort: the RSVP is already saved, so a wall hiccup never fails it.
  if (body.shareOnWall === true && message) {
    const wish = {
      name: cleanText(name, NAME_MAX, false),
      message: cleanText(message, MESSAGE_MAX, true),
      visibility: "public" as const,
    };
    if (Object.keys(validateWish(wish)).length === 0) {
      await createWish({ ...wish, source: "rsvp" }).catch((error) =>
        console.error("Failed to add RSVP message to the wishes wall:", error)
      );
    }
  }

  // Copy it into the Google Sheet once the guest already has their answer —
  // a slow or failing Sheet never delays or breaks the RSVP itself.
  after(() =>
    appendRsvpToSheet(entry).catch((error) => console.error("Failed to copy RSVP to Google Sheet:", error))
  );

  return NextResponse.json({ ok: true });
}

// Lets the couple pull a CSV of everyone who's RSVP'd, straight into
// Excel/Sheets. Gated behind a shared secret (RSVP_EXPORT_KEY) — with no key
// configured, guest names/phone numbers/messages are never exposed over the
// network. Set the env var, then visit /api/rsvp?key=<value> to download.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const expected = process.env.RSVP_EXPORT_KEY;

  if (!expected || key !== expected) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const csv = await exportRsvpsAsCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rsvps-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
