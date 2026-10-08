"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminShell, useToast } from "@/components/admin/AdminShell";
import { setDontCount, useDontCount } from "@/components/admin/dont-count";
import { countryName } from "@/lib/places";
import { ACTION_NAMES, VisitsList } from "./VisitsList";
import type { Count, SourceRow, VisitStats } from "@/lib/visits-store";

// Three views, so a phone isn't one long scroll: Overview (what's happening
// and how it's going), Visits (every visit, filtered) and Details (every
// breakdown the data has).

const SECTION_NAMES: Record<string, string> = {
  story: "Our Story",
  celebrations: "Celebrations",
  rsvp: "RSVP",
  gallery: "Gallery",
  music: "Music",
  note: "Note",
  wishes: "Wishes",
};

const DEVICE_NAMES: Record<string, string> = { phone: "📱 Phone", tablet: "📲 Tablet", computer: "💻 Computer" };

const FUNNEL_NAMES: Record<string, string> = {
  visited: "Visited",
  opened: "Opened the invite",
  "reached-rsvp": "Scrolled to the RSVP",
  rsvp: "Sent an RSVP",
  wish: "Left a wish",
};

type View = "overview" | "visits" | "details";
const VIEWS: [View, string][] = [
  ["overview", "Overview"],
  ["visits", "Visits"],
  ["details", "Details"],
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

function duration(minutes: number) {
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))}s`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

const shortDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return relative.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return relative.format(-Math.floor(seconds / 3600), "hour");
  return relative.format(-Math.floor(seconds / 86400), "day");
}

export function Analytics({ adminKey }: { adminKey: string }) {
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>("overview");
  // Bumped on every refresh, so the visits list reloads its page too.
  const [refreshToken, setRefreshToken] = useState(0);
  const dontCount = useDontCount();
  const toast = useToast();
  const api = `/api/visits/admin?key=${encodeURIComponent(adminKey)}`;

  const load = useCallback(() => {
    return fetch(api)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: VisitStats) => {
        setStats(data);
        setError("");
      })
      .catch(() => setError("Not found — check the key in the link."))
      .finally(() => setRefreshing(false));
  }, [api]);

  function refresh() {
    setRefreshing(true);
    setRefreshToken((n) => n + 1);
    load();
  }

  useEffect(() => {
    load();
    // Keeps itself fresh while it's left open — often enough for "on the invite now".
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setRefreshToken((n) => n + 1);
      load();
    }, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  async function toggleDontCount() {
    const next = !dontCount;
    if (await setDontCount(adminKey, next)) {
      toast.show(next ? "This device's visits are left out" : "This device counts again");
      refresh();
    } else {
      toast.show("Couldn't save that — check your connection and try again.", "error");
    }
  }

  function switchView(next: View) {
    setView(next);
    window.scrollTo({ top: 0 });
  }

  const t = stats?.totals;
  const device = typeof navigator !== "undefined" && /iPhone|Android/i.test(navigator.userAgent) ? "phone" : "browser";

  const toolbar = stats && t && t.visits > 0 && (
    <nav className="grid grid-cols-3 gap-1.5" aria-label="Views">
      {VIEWS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => switchView(id)}
          aria-pressed={view === id}
          className={`h-9 rounded-full font-body text-sm font-semibold transition-colors ${
            view === id ? "bg-ink text-white" : "bg-white text-ink/65 shadow-sm"
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  );

  return (
    <AdminShell tab="visitors" adminKey={adminKey} onRefresh={refresh} refreshing={refreshing} toolbar={toolbar}>
      {error && <p className="rounded-2xl bg-white/60 px-4 py-8 text-center font-body text-sm text-ink/55">{error}</p>}
      {!error && !stats && (
        <p className="rounded-2xl bg-white/60 px-4 py-8 text-center font-body text-sm text-ink/55">Loading visitors…</p>
      )}

      {stats && t && (
        <>
          {t.visits === 0 ? (
            <p className="rounded-3xl bg-white px-6 py-12 text-center font-body text-sm text-ink/55 shadow-sm">
              No visits yet. Once guests open the invitation link, they&apos;ll show up here.
            </p>
          ) : view === "overview" ? (
            <>
              <LiveCard
                live={stats.live}
                lastSeenAt={stats.lastSeenAt}
                generatedAt={stats.generatedAt}
                notYou={dontCount === true}
              />

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="People" value={t.visitors} note={`${t.returningVisitors} came back`} />
                <Tile label="Opened" value={t.opened} note={`${percent(t.opened, t.visits)} of ${plural(t.visits, "visit")}`} />
                <Tile label="RSVPs" value={t.rsvps} note="sent from a visit" />
                <Tile label="Today" value={t.today.visitors} note={plural(t.today.visits, "visit")} />
              </div>

              <Card title="From visit to RSVP" subtitle="Share of every visit that got this far">
                <Bars
                  rows={stats.funnel.map((s) => ({ label: FUNNEL_NAMES[s.label] ?? s.label, count: s.count }))}
                  total={t.visits}
                  keepOrder
                />
              </Card>

              <Card
                title="Visits per day"
                subtitle={`Since ${shortDay(stats.daily[0].day)} — tap a bar for the numbers`}
              >
                <DailyChart daily={stats.daily} />
              </Card>

              <Card title="Links you shared" subtitle="Add ?src=name to a link (like ?src=college) to tell each group apart">
                <SourceTable rows={stats.sourcesDetail} />
              </Card>
            </>
          ) : view === "visits" ? (
            <VisitsList adminKey={adminKey} refreshToken={refreshToken} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Visits" value={t.visits} note={`${t.today.visits} today`} />
                <Tile
                  label="Time spent"
                  value={t.medianMinutes === null ? "—" : duration(t.medianMinutes)}
                  note="typical, once opened"
                />
                <Tile label="Last 7 days" value={t.last7Days.visitors} note={`people · ${plural(t.last7Days.visits, "visit")}`} />
                <Tile label="Wishes" value={t.wishes} note="sent from a visit" />
              </div>

              <Card title="How far guests get" subtitle="Of the visits that opened the invitation">
                <Bars
                  rows={stats.sections.map((s) => ({ label: SECTION_NAMES[s.label] ?? s.label, count: s.count }))}
                  total={t.opened}
                  keepOrder
                />
              </Card>

              <Card
                title="What they tapped"
                subtitle={
                  stats.actionsSince
                    ? `Of the ${plural(stats.actionsBase, "visit")} that opened the invite since ${shortDay(stats.actionsSince.slice(0, 10))}`
                    : "Starts counting with the next visit"
                }
              >
                {stats.actionsBase ? (
                  <Bars
                    rows={stats.actions.map((a) => ({ label: ACTION_NAMES[a.label] ?? a.label, count: a.count }))}
                    total={stats.actionsBase}
                  />
                ) : (
                  <p className="font-body text-sm text-ink/45">No taps yet.</p>
                )}
              </Card>

              <div className="grid gap-x-4 sm:grid-cols-2">
                <Card title="Where from" subtitle="Roughly — the town their internet connection comes through">
                  <Bars rows={stats.places} total={t.visits} />
                </Card>
                <Card title="Countries">
                  <Bars rows={stats.countries.map((c) => ({ ...c, label: countryName(c.label) }))} total={t.visits} />
                </Card>
                <Card title="Devices">
                  <Bars
                    rows={stats.devices.map((d) => ({ ...d, label: DEVICE_NAMES[d.label] ?? d.label }))}
                    total={t.visits}
                  />
                </Card>
                <Card title="Browsers">
                  <Bars rows={stats.browsers} total={t.visits} />
                </Card>
                <Card title="Time of day" subtitle="Visits by hour, India time">
                  <HourlyChart hourly={stats.hourly} />
                </Card>
              </div>
            </>
          )}

          {dontCount !== null && view !== "visits" && (
            <label className="mt-4 flex cursor-pointer items-center gap-4 rounded-3xl bg-white p-4 shadow-sm">
              <span className="min-w-0 flex-1 font-body">
                <span className="block text-[15px] font-semibold text-ink">Don&apos;t count this {device}</span>
                <span className="mt-0.5 block text-xs text-ink/50">
                  {dontCount
                    ? `On — this ${device}'s visits are left out of every number, including the live count.`
                    : `Off — this ${device}'s visits count like a guest's.`}{" "}
                  It switches on by itself on any device that opens the admin.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={dontCount}
                onChange={toggleDontCount}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="relative h-7 w-12 flex-shrink-0 rounded-full bg-ink/15 transition-colors peer-checked:bg-rose peer-focus-visible:ring-2 peer-focus-visible:ring-rose/40 after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
              />
            </label>
          )}
        </>
      )}
      {toast.element}
    </AdminShell>
  );
}

/** Who has the invitation open right now, leaving out the couple's own devices. */
function LiveCard({
  live,
  lastSeenAt,
  generatedAt,
  notYou,
}: {
  live: number;
  lastSeenAt: string | null;
  generatedAt: string;
  notYou: boolean;
}) {
  return (
    <section className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm">
      <span className="relative grid size-11 flex-shrink-0 place-items-center rounded-full bg-leaf/12" aria-hidden>
        {live > 0 && <span className="absolute inset-0 animate-ping rounded-full bg-leaf/25" />}
        <span className={`size-3 rounded-full ${live ? "bg-leaf" : "bg-ink/20"}`} />
      </span>
      <div className="min-w-0 flex-1 font-body">
        <p className="text-[15px] font-bold text-ink" aria-live="polite">
          {live ? `${live} ${live === 1 ? "person is" : "people are"} on the invite now` : "No one on the invite right now"}
        </p>
        <p className="mt-0.5 text-xs text-ink/50">
          {lastSeenAt && !live ? `Last guest ${ago(lastSeenAt)} · ` : ""}
          {notYou ? "Not counting you · " : ""}updated {new Date(generatedAt).toLocaleTimeString("en-IN", { timeStyle: "short" })}
        </p>
      </div>
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <p className="font-body text-[11px] font-semibold uppercase tracking-wider text-ink/50">{label}</p>
      <p className="mt-1.5 font-display text-[2rem] font-semibold leading-none text-ink lining-nums tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 font-body text-xs text-ink/50">{note}</p>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-body text-[15px] font-bold text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 font-body text-xs text-ink/50">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Empty = () => <p className="font-body text-sm text-ink/45">No visits yet.</p>;

/** Horizontal bars, longest first (or in the given order), with the count and share. */
function Bars({ rows, total, keepOrder = false }: { rows: Count[]; total: number; keepOrder?: boolean }) {
  if (!total || rows.length === 0) return <Empty />;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2">
      {(keepOrder ? rows : [...rows].sort((a, b) => b.count - a.count)).map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 font-body text-sm">
            <span className="truncate text-ink/80">{r.label}</span>
            <span className="flex-shrink-0 tabular-nums text-ink/55">
              <span className="font-semibold text-ink">{r.count}</span> · {percent(r.count, total)}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-ink/6">
            <div className="h-full rounded-full bg-rose" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Each way in: how many came, and how many of them opened and RSVP'd. */
function SourceTable({ rows }: { rows: SourceRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full font-body text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink/50">
            <th className="px-1 pb-2 font-semibold">Link</th>
            <th className="px-1 pb-2 text-right font-semibold">People</th>
            <th className="px-1 pb-2 text-right font-semibold">Opened</th>
            <th className="px-1 pb-2 text-right font-semibold">RSVPs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/8">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="max-w-[10rem] truncate px-1 py-2 text-ink/85">{r.label}</td>
              <td className="px-1 py-2 text-right tabular-nums text-ink">{r.people}</td>
              <td className="px-1 py-2 text-right tabular-nums text-ink/70">{percent(r.opened, r.visits)}</td>
              <td className="px-1 py-2 text-right font-semibold tabular-nums text-ink">{r.rsvps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyChart({ daily }: { daily: VisitStats["daily"] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...daily.map((d) => d.visits), 1);
  const shown = active === null ? null : daily[active];
  return (
    <div>
      <p className="h-5 font-body text-xs text-ink/70" aria-live="polite">
        {shown ? (
          <>
            <span className="font-semibold text-ink">{shortDay(shown.day)}</span> · {shown.visits} visit
            {shown.visits === 1 ? "" : "s"} by {shown.visitors} {shown.visitors === 1 ? "person" : "people"}
          </>
        ) : (
          <span className="text-ink/45">Busiest day: {plural(max, "visit")}</span>
        )}
      </p>
      <div className="relative mt-2 h-36 border-b border-ink/15" onMouseLeave={() => setActive(null)}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-ink/10" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-ink/10" />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {daily.map((d, i) => (
            <button
              key={d.day}
              type="button"
              aria-label={`${shortDay(d.day)}: ${d.visits} visits`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              className="flex h-full flex-1 items-end"
            >
              <span
                className={`block w-full rounded-t-[4px] ${active === i ? "bg-rose-deep" : "bg-rose"} ${
                  d.visits ? "" : "opacity-0"
                }`}
                style={{ height: `${Math.max((d.visits / max) * 100, d.visits ? 3 : 0)}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between font-body text-[10px] text-ink/45">
        <span>{shortDay(daily[0].day)}</span>
        <span>{shortDay(daily[Math.floor(daily.length / 2)].day)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function HourlyChart({ hourly }: { hourly: number[] }) {
  const max = Math.max(...hourly, 1);
  const total = hourly.reduce((a, b) => a + b, 0);
  if (!total) return <Empty />;
  const label = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  return (
    <div>
      <div className="flex h-24 items-end gap-[2px] border-b border-ink/15">
        {hourly.map((count, h) => (
          <div
            key={h}
            title={`${label(h)}–${label((h + 1) % 24)}: ${count} visit${count === 1 ? "" : "s"}`}
            className="flex h-full flex-1 items-end"
          >
            <span
              className={`block w-full rounded-t-[4px] bg-dusk-deep ${count ? "" : "opacity-0"}`}
              style={{ height: `${Math.max((count / max) * 100, count ? 4 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-body text-[10px] text-ink/45">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>
    </div>
  );
}
