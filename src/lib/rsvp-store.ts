import { mkdir, appendFile, readFile } from "fs/promises";
import path from "path";
import { getDb } from "./mongo";

export type RsvpEntry = {
  name: string;
  phone: string;
  attending: "yes" | "no";
  events: string[];
  message: string;
  submittedAt: string;
};

// ── MongoDB Atlas is the target store (set MONGODB_URI to enable it). ──────
// Until that's provisioned, RSVPs are appended as JSON Lines to a local
// file. Appending is a single write() syscall, and writes below PIPE_BUF
// (a few KB — far more than one RSVP record needs) are atomic at the OS
// level, so two concurrent submissions can never interleave or clobber each
// other. The previous version read the whole array, pushed one entry in
// memory, and wrote the whole array back — under concurrent requests, the
// second write always won and silently discarded the first guest's RSVP.
// A second, independently-appended copy acts as a plain backup: if either
// file is ever truncated or corrupted, the other is untouched.
const DATA_DIR = path.join(process.cwd(), ".data");
const PRIMARY_FILE = path.join(DATA_DIR, "rsvps.jsonl");
const BACKUP_FILE = path.join(DATA_DIR, "rsvps.backup.jsonl");

async function getCollection() {
  const db = await getDb();
  return db ? db.collection<RsvpEntry>("rsvps") : null;
}

async function appendLocal(entry: RsvpEntry) {
  await mkdir(DATA_DIR, { recursive: true });
  const line = JSON.stringify(entry) + "\n";
  await Promise.all([
    appendFile(PRIMARY_FILE, line, "utf-8"),
    appendFile(BACKUP_FILE, line, "utf-8"),
  ]);
}

async function readLocalFile(file: string): Promise<RsvpEntry[]> {
  try {
    const raw = await readFile(file, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as RsvpEntry);
  } catch {
    return [];
  }
}

export async function saveRsvp(entry: RsvpEntry): Promise<void> {
  const collection = await getCollection();
  if (collection) {
    await collection.insertOne(entry);
    return;
  }

  await appendLocal(entry);
}

export async function listRsvps(): Promise<RsvpEntry[]> {
  const collection = await getCollection();
  if (collection) {
    return collection.find().sort({ submittedAt: -1 }).toArray();
  }
  const entries = await readLocalFile(PRIMARY_FILE);
  return entries.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

function csvCell(value: string): string {
  // Quote every field and escape embedded quotes, so a comma or newline in
  // a guest's message can never shift the row into the wrong columns.
  return `"${value.replace(/"/g, '""')}"`;
}

/** CSV the couple can open directly in Excel/Sheets — see the `key`-gated GET route. */
export async function exportRsvpsAsCsv(): Promise<string> {
  const entries = await listRsvps();
  const header = ["Name", "Phone", "Attending", "Events", "Message", "Submitted At"];
  const rows = entries.map((e) => [
    e.name,
    e.phone,
    e.attending,
    e.events.join("; "),
    e.message,
    e.submittedAt,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

// ── The couple's RSVP list ─────────────────────────────────────────────────

/** One guest's reply: their latest, with any earlier ones underneath. */
export type RsvpGuest = RsvpEntry & {
  /** Earlier replies from the same phone (or the same name, without one), newest first. */
  earlier: Pick<RsvpEntry, "attending" | "events" | "submittedAt">[];
};

/** Same phone, or — when there's no usable phone — the same name, means the same guest. */
function guestKey(entry: RsvpEntry) {
  const digits = entry.phone.replace(/\D/g, "");
  return digits.length >= 7 ? `phone:${digits.slice(-10)}` : `name:${entry.name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/** Every guest who's replied, newest reply first, a changed answer counted once. */
export async function listRsvpGuests(): Promise<RsvpGuest[]> {
  const guests = new Map<string, RsvpGuest>();
  // listRsvps() is newest first, so the first reply seen for a guest is their latest.
  for (const { name, phone, attending, events, message, submittedAt } of await listRsvps()) {
    const key = guestKey({ name, phone, attending, events, message, submittedAt });
    const known = guests.get(key);
    if (known) {
      known.earlier.push({ attending, events, submittedAt });
      if (!known.message && message) known.message = message;
    } else {
      guests.set(key, { name, phone, attending, events, message, submittedAt, earlier: [] });
    }
  }
  return [...guests.values()];
}
