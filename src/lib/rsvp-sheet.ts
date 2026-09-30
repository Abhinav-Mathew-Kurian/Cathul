import type { RsvpEntry } from "@/lib/rsvp-store";
import type { WishSource } from "@/lib/wishes-store";
import type { PublicWish, WishVisibility } from "@/lib/wish-rules";

// Mirrors RSVPs — and wishes, on their own "Wishes" tab — into a Google
// Sheet as they arrive, so the family can watch everything come in live
// (and download it as .xlsx any time). The Sheet side is a tiny Apps Script
// web app — see scripts/google-sheets-rsvp.gs for the code and setup steps.
//
// MongoDB stays the source of truth: this is a best-effort copy, and with
// GOOGLE_SHEETS_WEBHOOK_URL unset it does nothing at all.

async function post(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!url) return;

  const res = await fetch(url, {
    method: "POST",
    // Apps Script only parses the raw body for text/plain posts reliably.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  // Apps Script answers 200 even when the script itself rejects the
  // request, so the real outcome is in the JSON body.
  const result = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !result?.ok) {
    throw new Error(`Google Sheets append failed (${res.status}): ${result?.error ?? "unexpected response"}`);
  }
}

const secret = () => process.env.GOOGLE_SHEETS_WEBHOOK_SECRET ?? "";

export function appendRsvpToSheet(entry: RsvpEntry): Promise<void> {
  return post({ secret: secret(), ...entry });
}

// Wishes authenticate with `auth`, not `secret`, on purpose: an older copy
// of the Apps Script (RSVPs only) sees no `secret`, answers "Unauthorized"
// and appends nothing — rather than filing a wish as a bogus RSVP row. The
// Wishes tab starts filling in as soon as the updated script is deployed.
export function appendWishToSheet(
  wish: PublicWish & { visibility: WishVisibility; source: WishSource }
): Promise<void> {
  return post({ auth: secret(), kind: "wish", ...wish });
}

export function markWishHiddenInSheet(id: string, hidden: boolean): Promise<void> {
  return post({ auth: secret(), kind: "wish-hidden", id, hidden });
}
