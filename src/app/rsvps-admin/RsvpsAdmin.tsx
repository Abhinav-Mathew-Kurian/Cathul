"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminShell, SearchIcon, useToast } from "@/components/admin/AdminShell";
import { wedding } from "@/content/wedding";
import type { RsvpGuest } from "@/lib/rsvp-store";

// Everyone who's replied, one card per guest — a changed answer shows as
// their latest, with what they said before underneath. Counts are replies,
// not heads: the form doesn't ask how many are coming.

const EVENTS = wedding.celebrations.events.map((e) => ({
  id: e.id,
  short: e.type === "groom" ? "Groom's side" : "Bride's side",
  place: e.address,
  startsAt: e.startsAt,
}));
const eventName = (id: string) => {
  const event = EVENTS.find((e) => e.id === id);
  return event ? `${event.short} · ${event.place}` : id;
};

type Filter = "all" | "yes" | "no" | `event:${string}` | "message" | "changed";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "yes", label: "Coming" },
  { id: "no", label: "Can't come" },
  ...EVENTS.map((e) => ({ id: `event:${e.id}` as Filter, label: e.short })),
  { id: "message", label: "With a message" },
  { id: "changed", label: "Changed answer" },
];

function matches(g: RsvpGuest, f: Filter) {
  if (f === "all") return true;
  if (f === "yes" || f === "no") return g.attending === f;
  if (f === "message") return !!g.message;
  if (f === "changed") return g.earlier.length > 0;
  return g.attending === "yes" && g.events.includes(f.slice("event:".length));
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return relative.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return relative.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 7 * 86400) return relative.format(-Math.floor(seconds / 86400), "day");
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function daysUntil(iso: string) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "done";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function RsvpsAdmin({ adminKey }: { adminKey: string }) {
  const [guests, setGuests] = useState<RsvpGuest[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const key = encodeURIComponent(adminKey);

  const load = useCallback(() => {
    return fetch(`/api/rsvp/admin?key=${key}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { guests: RsvpGuest[] }) => {
        setGuests(data.guests);
        setError("");
      })
      .catch(() => setError("Not found — check the key in the link."))
      .finally(() => setRefreshing(false));
  }, [key]);

  function refresh() {
    setRefreshing(true);
    load();
  }

  useEffect(() => {
    load();
    // Keeps itself fresh while it's left open.
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const all = guests ?? [];
  const count = (f: Filter) => all.filter((g) => matches(g, f)).length;
  const needle = query.trim().toLowerCase();
  const shown = all.filter(
    (g) => matches(g, filter) && (!needle || `${g.name}\n${g.phone}\n${g.message}`.toLowerCase().includes(needle)),
  );

  async function copyNames() {
    try {
      await navigator.clipboard.writeText(shown.map((g) => g.name).join("\n"));
      toast.show(`Copied ${shown.length} ${shown.length === 1 ? "name" : "names"}`);
    } catch {
      toast.show("This browser won't let the page copy.", "error");
    }
  }

  const toolbar = guests && (
    <div className="space-y-2.5">
      <label className="flex h-11 items-center gap-2 rounded-2xl bg-white px-3.5 text-ink/45 shadow-sm focus-within:ring-2 focus-within:ring-rose/40">
        <SearchIcon />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names, phones or messages"
          className="h-full min-w-0 flex-1 bg-transparent font-body text-base text-ink outline-none placeholder:text-ink/40"
        />
      </label>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 font-body text-sm font-semibold transition-colors ${
              filter === id ? "bg-ink text-white" : "bg-white text-ink/65 shadow-sm"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 text-xs tabular-nums ${filter === id ? "bg-white/20" : "bg-ink/6 text-ink/55"}`}
            >
              {count(id)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const coming = count("yes");

  return (
    <AdminShell tab="rsvps" adminKey={adminKey} onRefresh={refresh} refreshing={refreshing} toolbar={toolbar}>
      {error && <Notice>{error}</Notice>}
      {!error && !guests && <Notice>Loading RSVPs…</Notice>}

      {guests && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Coming" value={coming} note={`of ${all.length} ${all.length === 1 ? "reply" : "replies"}`} />
            <Tile label="Can't come" value={count("no")} note={all[0] ? `latest ${ago(all[0].submittedAt)}` : "no replies yet"} />
            {EVENTS.map((e) => (
              <Tile
                key={e.id}
                label={e.short}
                value={count(`event:${e.id}`)}
                note={`${e.place} · ${daysUntil(e.startsAt)}`}
              />
            ))}
          </div>
          <p className="mt-2 mb-4 px-1 font-body text-xs text-ink/50">
            One per guest — if someone replied twice, their latest answer counts. These are replies, not headcounts.
          </p>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copyNames}
              disabled={shown.length === 0}
              className="h-11 rounded-2xl bg-white font-body text-sm font-semibold text-ink/75 shadow-sm active:scale-[0.98] disabled:opacity-40"
            >
              Copy {shown.length} {shown.length === 1 ? "name" : "names"}
            </button>
            <a
              href={`/api/rsvp?key=${key}`}
              className="grid h-11 place-items-center rounded-2xl bg-white font-body text-sm font-semibold text-ink/75 shadow-sm active:scale-[0.98]"
            >
              Download all (CSV)
            </a>
          </div>

          {shown.length === 0 ? (
            <Notice>{needle ? `No one matches “${query.trim()}”.` : all.length ? "No one here." : "No RSVPs yet."}</Notice>
          ) : (
            <ul className="space-y-3">
              {shown.map((g) => (
                <GuestCard key={`${g.submittedAt}-${g.name}`} guest={g} />
              ))}
            </ul>
          )}
        </>
      )}
      {toast.element}
    </AdminShell>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-white/60 px-4 py-8 text-center font-body text-sm text-ink/55">{children}</p>;
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

function answer(attending: RsvpGuest["attending"], events: string[]) {
  return attending === "no" ? "Can't come" : `Coming to ${events.map((id) => eventName(id).split(" · ")[0]).join(" and ") || "—"}`;
}

function GuestCard({ guest: g }: { guest: RsvpGuest }) {
  const digits = g.phone.replace(/\D/g, "");
  return (
    <li className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 flex-shrink-0 place-items-center rounded-full bg-rose/12 font-body text-base font-bold text-rose-deep"
          >
            {[...g.name.trim()][0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-body text-[15px] font-bold text-ink">{g.name}</p>
              <time
                dateTime={g.submittedAt}
                title={new Date(g.submittedAt).toLocaleString("en-IN")}
                className="flex-shrink-0 font-body text-xs text-ink/45"
              >
                {ago(g.submittedAt)}
              </time>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {g.attending === "yes" ? (
                g.events.map((id) => (
                  <Tag key={id} tone="sky">
                    {eventName(id)}
                  </Tag>
                ))
              ) : (
                <Tag tone="muted">Can&apos;t come</Tag>
              )}
              {g.earlier.length > 0 && <Tag tone="rose">Changed answer</Tag>}
            </div>
          </div>
        </div>

        {g.message && (
          <p className="mt-3 whitespace-pre-line font-body text-[15px] leading-relaxed text-ink/85 [overflow-wrap:anywhere]">
            “{g.message}”
          </p>
        )}

        {g.earlier.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-2xl bg-ink/4 px-3 py-2 font-body text-xs text-ink/55">
            {g.earlier.map((e) => (
              <li key={e.submittedAt}>
                Before, {ago(e.submittedAt)}: {answer(e.attending, e.events)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {digits && (
        <div className="grid grid-cols-2 gap-px border-t border-ink/8 bg-ink/8">
          <a
            href={`tel:${g.phone.replace(/[^\d+]/g, "")}`}
            className="flex h-12 items-center justify-center gap-1.5 bg-white font-body text-sm font-semibold text-ink/70 active:bg-cream"
          >
            <span className="truncate px-2">📞 {g.phone}</span>
          </a>
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center gap-1.5 bg-white font-body text-sm font-semibold text-ink/70 active:bg-cream"
          >
            💬 WhatsApp
          </a>
        </div>
      )}
    </li>
  );
}

function Tag({ tone, children }: { tone: "sky" | "rose" | "muted"; children: ReactNode }) {
  const tones = {
    sky: "bg-sky-top/25 text-dusk-deep",
    rose: "bg-rose/12 text-rose-deep",
    muted: "bg-ink/5 text-ink/50",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
