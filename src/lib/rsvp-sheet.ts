import type { RsvpEntry } from "@/lib/rsvp-store";

// Mirrors each RSVP into a Google Sheet as it arrives, so the couple can
// watch the guest list fill up live (and download it as .xlsx any time).
// The Sheet side is a tiny Apps Script web app — see
// scripts/google-sheets-rsvp.gs for the code and setup steps.
//
// MongoDB stays the source of truth: this is a best-effort copy, and with
// GOOGLE_SHEETS_WEBHOOK_URL unset it does nothing at all.
export async function appendRsvpToSheet(entry: RsvpEntry): Promise<void> {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!url) return;

  const res = await fetch(url, {
    method: "POST",
    // Apps Script only parses the raw body for text/plain posts reliably.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret: process.env.GOOGLE_SHEETS_WEBHOOK_SECRET ?? "", ...entry }),
    signal: AbortSignal.timeout(15_000),
  });

  // Apps Script answers 200 even when the script itself rejects the
  // request, so the real outcome is in the JSON body.
  const result = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !result?.ok) {
    throw new Error(`Google Sheets append failed (${res.status}): ${result?.error ?? "unexpected response"}`);
  }
}
