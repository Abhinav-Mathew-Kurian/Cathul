import { getDb } from "./mongo";
import { SECTIONS, type Section } from "./sections";

// One document per visit (a page load), in its own collection. No cookies and
// nothing personal: the browser keeps a random visitor id in localStorage so
// returning guests count once, and the place comes from Vercel's IP-geo
// headers — the IP itself is never stored.
//
// A visit is created by "start", then only ever *updated* by later events,
// and only if it exists — a made-up visit id can't create anything.

export type VisitEvent = "open" | "rsvp" | "wish" | "ping" | `section:${Section}`;

type VisitDoc = {
  _id: string;
  visitorId: string;
  /** This browser had been here before. */
  returning: boolean;
  startedAt: Date;
  lastSeenAt: Date;
  source: string;
  device: "phone" | "tablet" | "computer";
  browser: string;
  country: string;
  region: string;
  city: string;
  /** Tapped the wax seal. */
  opened: boolean;
  sections: Section[];
  rsvp: boolean;
  wish: boolean;
  /**
   * Seconds the guest actually spent with the page on screen and in use (see
   * src/lib/track.ts). Absent on visits from before it was measured — those
   * keep their first-to-last-signal span.
   */
  activeSeconds?: number;
};

export type VisitStart = Pick<VisitDoc, "_id" | "visitorId" | "returning" | "source" | "device" | "browser" | "country" | "region" | "city">;

// ── Storage: MongoDB, or memory in local dev without MONGODB_URI ───────────

let indexesReady: Promise<unknown> | null = null;
const memory = new Map<string, VisitDoc>();

async function collection() {
  const db = await getDb();
  if (!db) return null;
  const visits = db.collection<VisitDoc>("visits");
  indexesReady ??= visits.createIndex({ startedAt: -1 }).catch((error) => {
    indexesReady = null;
    console.error("Failed to ensure visit indexes:", error);
  });
  return visits;
}

export async function startVisit(start: VisitStart): Promise<void> {
  const now = new Date();
  const { _id, ...fields } = start;
  const doc = {
    ...fields,
    startedAt: now,
    lastSeenAt: now,
    opened: false,
    sections: [],
    rsvp: false,
    wish: false,
    activeSeconds: 0,
  };
  const visits = await collection();
  if (!visits) {
    if (!memory.has(_id)) memory.set(_id, { _id, ...doc });
    return;
  }
  // Insert-only upsert, so a retried beacon can't reset a visit.
  await visits.updateOne({ _id }, { $setOnInsert: doc }, { upsert: true });
}

/** `activeSeconds` only ever raises the stored figure, so a late or out-of-order beacon can't lower it. */
export async function recordVisitEvent(id: string, event: VisitEvent, activeSeconds: number | null): Promise<void> {
  const lastSeenAt = new Date();
  const set: Partial<VisitDoc> = { lastSeenAt };
  let section: Section | null = null;
  if (event === "open") set.opened = true;
  else if (event === "rsvp" || event === "wish") set[event] = true;
  else if (event.startsWith("section:")) section = event.slice("section:".length) as Section;

  const visits = await collection();
  if (!visits) {
    const doc = memory.get(id);
    if (!doc) return;
    Object.assign(doc, set);
    if (section && !doc.sections.includes(section)) doc.sections.push(section);
    if (activeSeconds !== null) doc.activeSeconds = Math.max(doc.activeSeconds ?? 0, activeSeconds);
    return;
  }
  await visits.updateOne(
    // A visit stops counting time after a day, so a tab left open for a
    // week doesn't read as a week-long visit.
    { _id: id, startedAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    {
      $set: set,
      ...(section && { $addToSet: { sections: section } }),
      ...(activeSeconds !== null && { $max: { activeSeconds } }),
    }
  );
}

// ── The couple's dashboard ─────────────────────────────────────────────────

const TIME_ZONE = "Asia/Kolkata";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const hourOf = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" });

export type Count = { label: string; count: number };

export type VisitStats = {
  generatedAt: string;
  totals: {
    visits: number;
    visitors: number;
    returningVisitors: number;
    opened: number;
    rsvps: number;
    wishes: number;
    today: { visits: number; visitors: number };
    last7Days: { visits: number; visitors: number };
    /** Median minutes spent, over visits that opened the invitation. */
    medianMinutes: number | null;
  };
  /** Last 30 days, oldest first, India time. */
  daily: { day: string; visits: number; visitors: number }[];
  /** Visits per hour of the day (0–23, India time). */
  hourly: number[];
  /** Of the visits that opened the invitation, how many reached each section. */
  sections: Count[];
  places: Count[];
  countries: Count[];
  sources: Count[];
  devices: Count[];
  browsers: Count[];
  recent: {
    startedAt: string;
    minutes: number;
    place: string;
    device: string;
    source: string;
    returning: boolean;
    opened: boolean;
    furthest: string | null;
    rsvp: boolean;
    wish: boolean;
  }[];
};

function tally(values: string[], top = 8): Count[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const sorted = [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  if (sorted.length <= top) return sorted;
  const rest = sorted.slice(top - 1).reduce((sum, c) => sum + c.count, 0);
  return [...sorted.slice(0, top - 1), { label: "Other", count: rest }];
}

const placeOf = (v: Pick<VisitDoc, "city" | "region" | "country">) =>
  [v.city, v.region].filter(Boolean).join(", ") || v.country || "Unknown";

const minutesOf = (v: VisitDoc) =>
  v.activeSeconds !== undefined ? v.activeSeconds / 60 : (v.lastSeenAt.getTime() - v.startedAt.getTime()) / 60000;

export async function getVisitStats(): Promise<VisitStats> {
  const visits = await collection();
  const all = visits
    ? await visits.find().sort({ startedAt: -1 }).limit(100_000).toArray()
    : [...memory.values()].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const now = Date.now();
  const today = dayKey.format(now);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const unique = (list: VisitDoc[]) => new Set(list.map((v) => v.visitorId)).size;

  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(dayKey.format(now - i * 24 * 60 * 60 * 1000));
  const byDay = new Map(days.map((d) => [d, [] as VisitDoc[]]));
  const hourly = Array<number>(24).fill(0);
  for (const v of all) {
    byDay.get(dayKey.format(v.startedAt))?.push(v);
    hourly[Number(hourOf.format(v.startedAt))]++;
  }

  const opened = all.filter((v) => v.opened);
  const minutes = opened.map(minutesOf).sort((a, b) => a - b);
  const todays = byDay.get(today) ?? [];
  const week = all.filter((v) => v.startedAt.getTime() >= weekAgo);
  const visitorsWhoReturned = new Set(all.filter((v) => v.returning).map((v) => v.visitorId));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      visits: all.length,
      visitors: unique(all),
      returningVisitors: visitorsWhoReturned.size,
      opened: opened.length,
      rsvps: all.filter((v) => v.rsvp).length,
      wishes: all.filter((v) => v.wish).length,
      today: { visits: todays.length, visitors: unique(todays) },
      last7Days: { visits: week.length, visitors: unique(week) },
      medianMinutes: minutes.length ? minutes[Math.floor(minutes.length / 2)] : null,
    },
    daily: days.map((day) => ({ day, visits: byDay.get(day)!.length, visitors: unique(byDay.get(day)!) })),
    hourly,
    sections: SECTIONS.map((s) => ({ label: s, count: opened.filter((v) => v.sections.includes(s)).length })),
    places: tally(all.map(placeOf), 10),
    countries: tally(all.map((v) => v.country || "Unknown"), 6),
    sources: tally(all.map((v) => v.source)),
    devices: tally(all.map((v) => v.device)),
    browsers: tally(all.map((v) => v.browser), 6),
    recent: all.slice(0, 25).map((v) => ({
      startedAt: v.startedAt.toISOString(),
      minutes: minutesOf(v),
      place: placeOf(v),
      device: v.device,
      source: v.source,
      returning: v.returning,
      opened: v.opened,
      furthest: [...SECTIONS].reverse().find((s) => v.sections.includes(s)) ?? null,
      rsvp: v.rsvp,
      wish: v.wish,
    })),
  };
}
