import type { Filter } from "mongodb";
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
};

/** One visit as the couple's list shows it. */
export type VisitRow = {
  id: string;
  /** Which guest: 1 for the first browser ever to visit, 2 for the next, and so on. */
  guest: number;
  /** Every visit that guest has made, this one included. */
  guestVisits: number;
  startedAt: string;
  minutes: number;
  place: string;
  country: string;
  device: string;
  browser: string;
  source: string;
  returning: boolean;
  opened: boolean;
  furthest: string | null;
  rsvp: boolean;
  wish: boolean;
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

type Guest = { number: number; visits: number };

/**
 * Numbers every visitor id by its first visit, oldest first, so the same
 * browser keeps the same number on every visit and every page of the list.
 */
async function guestNumbers(visits: Awaited<ReturnType<typeof collection>>): Promise<Map<string, Guest>> {
  const groups = visits
    ? await visits
        .aggregate<{ _id: string; visits: number }>([
          { $group: { _id: "$visitorId", first: { $min: "$startedAt" }, visits: { $sum: 1 } } },
          { $sort: { first: 1, _id: 1 } },
          { $project: { visits: 1 } },
        ])
        .toArray()
    : [...memory.values()]
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
        .map((v) => ({ _id: v.visitorId, visits: 1 }));
  const guests = new Map<string, Guest>();
  for (const { _id, visits } of groups) {
    const known = guests.get(_id);
    if (known) known.visits += visits;
    else guests.set(_id, { number: guests.size + 1, visits });
  }
  return guests;
}

function toRow(v: VisitDoc, guest: Guest | undefined): VisitRow {
  return {
    id: v._id,
    guest: guest?.number ?? 0,
    guestVisits: guest?.visits ?? 1,
    startedAt: v.startedAt.toISOString(),
    minutes: minutesOf(v),
    place: placeOf(v),
    country: v.country,
    device: v.device,
    browser: v.browser,
    source: v.source,
    returning: v.returning,
    opened: v.opened,
    furthest: [...SECTIONS].reverse().find((s) => v.sections.includes(s)) ?? null,
    rsvp: v.rsvp,
    wish: v.wish,
  };
}

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
  };
}

// ── Every visit, filtered and paged ────────────────────────────────────────

export const VISIT_PAGE_SIZE = 15;
const RANGES = ["today", "7d", "30d", "all"] as const;
const SORTS = ["newest", "oldest", "longest"] as const;
const MIN_SECONDS = [0, 30, 60, 300] as const;
/** Stands in for an empty town or country in the filters. */
export const UNKNOWN = "Unknown";

export type VisitFilters = {
  range: (typeof RANGES)[number];
  status: "any" | "opened" | "not-opened";
  visitor: "any" | "new" | "returning";
  rsvp: boolean;
  wish: boolean;
  reached: Section | "";
  minSeconds: (typeof MIN_SECONDS)[number];
  device: string;
  source: string;
  browser: string;
  country: string;
  city: string;
  sort: (typeof SORTS)[number];
};

export type VisitFilterOptions = Record<"device" | "source" | "browser" | "country" | "city", string[]>;

export type VisitPage = {
  visits: VisitRow[];
  total: number;
  page: number;
  pages: number;
  options?: VisitFilterOptions;
};

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Reads the filters from a query string, falling back to "everything" for anything unknown. */
export function parseVisitFilters(params: URLSearchParams): VisitFilters {
  const text = (name: string) => (params.get(name) ?? "").slice(0, 80);
  return {
    range: pick(params.get("range"), RANGES, "all"),
    status: pick(params.get("status"), ["any", "opened", "not-opened"] as const, "any"),
    visitor: pick(params.get("visitor"), ["any", "new", "returning"] as const, "any"),
    rsvp: params.get("rsvp") === "1",
    wish: params.get("wish") === "1",
    reached: pick(params.get("reached"), SECTIONS, "" as Section) as Section | "",
    minSeconds: MIN_SECONDS.find((s) => String(s) === params.get("minSeconds")) ?? 0,
    device: text("device"),
    source: text("source"),
    browser: text("browser"),
    country: text("country"),
    city: text("city"),
    sort: pick(params.get("sort"), SORTS, "newest"),
  };
}

/** Start of the range, India time ("today" starts at midnight IST). */
function rangeStart(range: VisitFilters["range"]): Date | null {
  if (range === "all") return null;
  const midnight = new Date(`${dayKey.format(Date.now())}T00:00:00+05:30`);
  const days = range === "today" ? 0 : range === "7d" ? 6 : 29;
  return new Date(midnight.getTime() - days * 24 * 60 * 60 * 1000);
}

const exact = (value: string) => (value === UNKNOWN ? "" : value);

function mongoFilter(f: VisitFilters): Filter<VisitDoc> {
  const since = rangeStart(f.range);
  return {
    ...(since && { startedAt: { $gte: since } }),
    ...(f.status !== "any" && { opened: f.status === "opened" }),
    ...(f.visitor !== "any" && { returning: f.visitor === "returning" }),
    ...(f.rsvp && { rsvp: true }),
    ...(f.wish && { wish: true }),
    ...(f.reached && { sections: f.reached }),
    ...(f.device && { device: f.device as VisitDoc["device"] }),
    ...(f.source && { source: f.source }),
    ...(f.browser && { browser: f.browser }),
    ...(f.country && { country: exact(f.country) }),
    ...(f.city && { city: exact(f.city) }),
  };
}

function matchesFilter(v: VisitDoc, f: VisitFilters): boolean {
  const since = rangeStart(f.range);
  return (
    (!since || v.startedAt >= since) &&
    (f.status === "any" || v.opened === (f.status === "opened")) &&
    (f.visitor === "any" || v.returning === (f.visitor === "returning")) &&
    (!f.rsvp || v.rsvp) &&
    (!f.wish || v.wish) &&
    (!f.reached || v.sections.includes(f.reached)) &&
    (!f.device || v.device === f.device) &&
    (!f.source || v.source === f.source) &&
    (!f.browser || v.browser === f.browser) &&
    (!f.country || v.country === exact(f.country)) &&
    (!f.city || v.city === exact(f.city)) &&
    minutesOf(v) * 60 >= f.minSeconds
  );
}

const sortedOptions = (values: string[]) =>
  [...new Set(values.map((v) => v || UNKNOWN))].sort((a, b) => a.localeCompare(b));

/**
 * One page of visits matching `filters`. The database does the filtering,
 * sorting and paging, so the dashboard only ever downloads fifteen rows.
 * `withOptions` adds every value each dropdown can offer.
 */
export async function listVisits(filters: VisitFilters, page: number, withOptions = false): Promise<VisitPage> {
  const skip = (Math.max(1, page) - 1) * VISIT_PAGE_SIZE;
  const visits = await collection();
  let rows: VisitDoc[];
  let total: number;
  let options: VisitFilterOptions | undefined;

  if (visits) {
    // Time spent, as minutesOf() works it out, in seconds — so "1 min or
    // more" and "longest first" run in the database.
    const seconds = {
      $ifNull: ["$activeSeconds", { $divide: [{ $subtract: ["$lastSeenAt", "$startedAt"] }, 1000] }],
    };
    const sort =
      filters.sort === "longest"
        ? { seconds: -1 as const, startedAt: -1 as const }
        : { startedAt: filters.sort === "oldest" ? (1 as const) : (-1 as const) };
    const [result] = await visits
      .aggregate<{ rows: VisitDoc[]; total: { n: number }[] }>([
        { $match: mongoFilter(filters) },
        { $addFields: { seconds } },
        ...(filters.minSeconds ? [{ $match: { seconds: { $gte: filters.minSeconds } } }] : []),
        { $sort: sort },
        { $facet: { rows: [{ $skip: skip }, { $limit: VISIT_PAGE_SIZE }], total: [{ $count: "n" }] } },
      ])
      .toArray();
    rows = result?.rows ?? [];
    total = result?.total[0]?.n ?? 0;
    if (withOptions) {
      const [device, source, browser, country, city] = await Promise.all(
        (["device", "source", "browser", "country", "city"] as const).map((field) => visits.distinct(field))
      );
      options = {
        device: sortedOptions(device as string[]),
        source: sortedOptions(source as string[]),
        browser: sortedOptions(browser as string[]),
        country: sortedOptions(country as string[]),
        city: sortedOptions(city as string[]),
      };
    }
  } else {
    const all = [...memory.values()];
    const matched = all.filter((v) => matchesFilter(v, filters));
    matched.sort((a, b) =>
      filters.sort === "longest"
        ? minutesOf(b) - minutesOf(a) || b.startedAt.getTime() - a.startedAt.getTime()
        : (b.startedAt.getTime() - a.startedAt.getTime()) * (filters.sort === "oldest" ? -1 : 1)
    );
    rows = matched.slice(skip, skip + VISIT_PAGE_SIZE);
    total = matched.length;
    if (withOptions) {
      options = {
        device: sortedOptions(all.map((v) => v.device)),
        source: sortedOptions(all.map((v) => v.source)),
        browser: sortedOptions(all.map((v) => v.browser)),
        country: sortedOptions(all.map((v) => v.country)),
        city: sortedOptions(all.map((v) => v.city)),
      };
    }
  }

  const guests = await guestNumbers(visits);
  return {
    visits: rows.map((v) => toRow(v, guests.get(v.visitorId))),
    total,
    page: Math.max(1, page),
    pages: Math.max(1, Math.ceil(total / VISIT_PAGE_SIZE)),
    ...(options && { options }),
  };
}

// ── One guest ──────────────────────────────────────────────────────────────

export type GuestVisits = { guest: number; visits: VisitRow[] };

/** Every visit by guest number `guest`, newest first, or null if there's no such guest. */
export async function getGuestVisits(guest: number): Promise<GuestVisits | null> {
  const visits = await collection();
  const guests = await guestNumbers(visits);
  const entry = [...guests].find(([, g]) => g.number === guest);
  if (!entry) return null;
  const [visitorId, info] = entry;
  const docs = visits
    ? await visits.find({ visitorId }).sort({ startedAt: -1 }).limit(500).toArray()
    : [...memory.values()]
        .filter((v) => v.visitorId === visitorId)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return { guest, visits: docs.map((v) => toRow(v, info)) };
}
