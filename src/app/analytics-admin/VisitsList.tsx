"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SECTIONS } from "@/lib/sections";
import type { VisitFilterOptions, VisitFilters, VisitPage, VisitRow } from "@/lib/visits-store";

// Every visit, fifteen at a time, with every filter the data supports. The
// server does the filtering and paging, so this only ever holds one page.

const SECTION_NAMES: Record<string, string> = {
  story: "Our Story",
  celebrations: "Celebrations",
  rsvp: "RSVP",
  note: "Note",
  wishes: "Wishes",
  gallery: "Gallery",
  music: "Music",
};
const DEVICE_NAMES: Record<string, string> = { phone: "📱 Phone", tablet: "📲 Tablet", computer: "💻 Computer" };

const ALL: VisitFilters = {
  range: "all",
  status: "any",
  visitor: "any",
  rsvp: false,
  wish: false,
  reached: "",
  minSeconds: 0,
  device: "",
  source: "",
  browser: "",
  country: "",
  city: "",
  sort: "newest",
};

const RANGES: [VisitFilters["range"], string][] = [
  ["all", "All time"],
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
];

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code: string) => {
  try {
    return code.length === 2 ? (regionNames.of(code) ?? code) : code;
  } catch {
    return code;
  }
};

function duration(minutes: number) {
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))}s`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

/** The filters in the sheet (everything but the range chips and the sort). */
function sheetFilterCount(f: VisitFilters) {
  return (Object.keys(ALL) as (keyof VisitFilters)[]).filter(
    (k) => k !== "range" && k !== "sort" && f[k] !== ALL[k]
  ).length;
}

function query(f: VisitFilters, page: number, withOptions: boolean) {
  const params = new URLSearchParams({ view: "visits", page: String(page) });
  for (const [k, v] of Object.entries(f)) {
    if (v === ALL[k as keyof VisitFilters]) continue;
    params.set(k, typeof v === "boolean" ? "1" : String(v));
  }
  if (withOptions) params.set("options", "1");
  return params.toString();
}

export function VisitsList({ adminKey, refreshToken }: { adminKey: string; refreshToken: number }) {
  const [filters, setFilters] = useState<VisitFilters>(ALL);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<VisitPage | null>(null);
  const [options, setOptions] = useState<VisitFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // A new page of results whenever the filters, the page or a refresh change.
  // The dropdowns' choices come along with the first load and each refresh.
  const wantOptions = useRef(true);
  useEffect(() => {
    wantOptions.current = true;
  }, [refreshToken]);
  useEffect(() => {
    const controller = new AbortController();
    const withOptions = wantOptions.current;
    fetch(`/api/visits/admin?key=${encodeURIComponent(adminKey)}&${query(filters, page, withOptions)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((result: VisitPage) => {
        setData(result);
        if (result.options) {
          setOptions(result.options);
          wantOptions.current = false;
        }
        setFailed(false);
        setLoading(false);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setFailed(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [adminKey, filters, page, refreshToken]);

  function update(next: Partial<VisitFilters>) {
    setLoading(true);
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  }

  function goTo(next: number) {
    setLoading(true);
    setPage(next);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const active = sheetFilterCount(filters);
  const pages = data?.pages ?? 1;

  return (
    <section className="mt-4 scroll-mt-28 rounded-3xl bg-white p-4 shadow-sm sm:p-5" ref={topRef}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-body text-[15px] font-bold text-ink">Visits</h2>
        <p className="font-body text-xs text-ink/50" aria-live="polite">
          {data ? `${data.total} ${data.total === 1 ? "visit" : "visits"}` : ""}
        </p>
      </div>

      {/* Time range — the filter used most, always one tap away. */}
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
        {RANGES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => update({ range: id })}
            aria-pressed={filters.range === id}
            className={`h-9 flex-shrink-0 rounded-full px-3.5 font-body text-sm font-semibold transition-colors ${
              filters.range === id ? "bg-ink text-white" : "bg-ink/6 text-ink/65"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`flex h-10 items-center gap-2 rounded-full px-4 font-body text-sm font-semibold ${
            active ? "bg-rose text-white" : "border border-ink/15 text-ink/75"
          }`}
        >
          <FilterIcon />
          Filters
          {active > 0 && <span className="rounded-full bg-white/25 px-1.5 text-xs tabular-nums">{active}</span>}
        </button>
        <label className="relative flex h-10 min-w-0 flex-1 items-center rounded-full border border-ink/15 pr-8 pl-4">
          <span className="sr-only">Sort</span>
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as VisitFilters["sort"] })}
            className="w-full appearance-none truncate bg-transparent font-body text-sm font-semibold text-ink/75 outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="longest">Longest stay first</option>
          </select>
          <Chevron />
        </label>
      </div>

      {active > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {chipsFor(filters).map(([label, reset]) => (
            <button
              key={label}
              type="button"
              onClick={() => update(reset)}
              className="flex items-center gap-1 rounded-full bg-rose/10 py-1 pr-2 pl-2.5 font-body text-xs font-semibold text-rose-deep"
            >
              {label}
              <span aria-hidden className="text-sm leading-none">
                ×
              </span>
              <span className="sr-only">(remove)</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => update({ ...ALL, range: filters.range, sort: filters.sort })}
            className="px-1.5 py-1 font-body text-xs font-semibold text-ink/50 underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      )}

      <div className={`mt-3 transition-opacity ${loading && data ? "opacity-50" : ""}`}>
        {failed && !data ? (
          <p className="py-8 text-center font-body text-sm text-rose-deep">Couldn&apos;t load visits. Tap refresh at the top.</p>
        ) : !data ? (
          <p className="py-8 text-center font-body text-sm text-ink/45">Loading visits…</p>
        ) : data.visits.length === 0 ? (
          <p className="py-8 text-center font-body text-sm text-ink/45">No visits match these filters.</p>
        ) : (
          <ul className="divide-y divide-ink/8">
            {data.visits.map((v) => (
              <VisitItem key={v.id} visit={v} />
            ))}
          </ul>
        )}
      </div>

      {data && pages > 1 && (
        <nav className="mt-3 flex items-center justify-between gap-3 border-t border-ink/8 pt-3" aria-label="Pages">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => goTo(page - 1)}
            className="h-11 rounded-full bg-ink/6 px-4 font-body text-sm font-semibold text-ink/75 disabled:opacity-35"
          >
            ‹ Newer
          </button>
          <span className="font-body text-xs text-ink/55 tabular-nums">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => goTo(page + 1)}
            className="h-11 rounded-full bg-ink/6 px-4 font-body text-sm font-semibold text-ink/75 disabled:opacity-35"
          >
            Older ›
          </button>
        </nav>
      )}

      {sheetOpen && (
        <FilterSheet
          filters={filters}
          options={options}
          total={data?.total ?? null}
          loading={loading}
          onChange={update}
          onClear={() => update({ ...ALL, range: filters.range, sort: filters.sort })}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </section>
  );
}

/** A chip for each active filter, with what removing it resets. */
function chipsFor(f: VisitFilters): [string, Partial<VisitFilters>][] {
  const chips: [string, Partial<VisitFilters>][] = [];
  if (f.status !== "any") chips.push([f.status === "opened" ? "Opened" : "Didn't open", { status: "any" }]);
  if (f.visitor !== "any") chips.push([f.visitor === "new" ? "First visit" : "Came back", { visitor: "any" }]);
  if (f.rsvp) chips.push(["RSVP'd", { rsvp: false }]);
  if (f.wish) chips.push(["Left a wish", { wish: false }]);
  if (f.minSeconds) chips.push([`${f.minSeconds >= 60 ? `${f.minSeconds / 60} min` : `${f.minSeconds}s`}+`, { minSeconds: 0 }]);
  if (f.reached) chips.push([`Reached ${SECTION_NAMES[f.reached]}`, { reached: "" }]);
  if (f.city) chips.push([f.city, { city: "" }]);
  if (f.country) chips.push([countryName(f.country), { country: "" }]);
  if (f.device) chips.push([DEVICE_NAMES[f.device] ?? f.device, { device: "" }]);
  if (f.source) chips.push([f.source, { source: "" }]);
  if (f.browser) chips.push([f.browser, { browser: "" }]);
  return chips;
}

function VisitItem({ visit: v }: { visit: VisitRow }) {
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-body text-sm font-semibold text-ink">
          <span className="text-rose-deep">Guest {v.guest}</span> · {v.place}
          {v.returning && <span className="font-normal text-ink/45"> · came back</span>}
        </p>
        <p className="mt-0.5 font-body text-xs leading-relaxed text-ink/55">
          {DEVICE_NAMES[v.device] ?? v.device} · {v.browser} · {v.source}
        </p>
        <p className="mt-1 flex flex-wrap gap-1">
          {v.opened ? (
            <Tag tone="ok">{v.furthest ? `Read to ${SECTION_NAMES[v.furthest]}` : "Opened"}</Tag>
          ) : (
            <Tag tone="muted">Didn&apos;t open</Tag>
          )}
          {v.rsvp && <Tag tone="rose">💌 RSVP&apos;d</Tag>}
          {v.wish && <Tag tone="rose">🏮 Wish</Tag>}
        </p>
      </div>
      <p className="flex-shrink-0 text-right font-body text-xs text-ink/50">
        {new Date(v.startedAt).toLocaleString("en-IN", { day: "numeric", month: "short" })}
        <span className="block">
          {new Date(v.startedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
        </span>
        {v.opened && <span className="mt-0.5 block font-semibold text-ink/70">{duration(v.minutes)}</span>}
      </p>
    </li>
  );
}

function Tag({ tone, children }: { tone: "ok" | "rose" | "muted"; children: ReactNode }) {
  const tones = { ok: "bg-sky-top/25 text-dusk-deep", rose: "bg-rose/12 text-rose-deep", muted: "bg-ink/6 text-ink/50" };
  return (
    <span className={`rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${tones[tone]}`}>{children}</span>
  );
}

// ── The filter sheet ───────────────────────────────────────────────────────

function FilterSheet({
  filters: f,
  options,
  total,
  loading,
  onChange,
  onClear,
  onClose,
}: {
  filters: VisitFilters;
  options: VisitFilterOptions | null;
  total: number | null;
  loading: boolean;
  onChange: (next: Partial<VisitFilters>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Filter visits">
      <button type="button" aria-label="Close filters" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-ink/15 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between border-b border-ink/8 px-5 pt-3 pb-3 sm:pt-5">
          <h2 className="font-body text-lg font-bold text-ink">Filters</h2>
          <button type="button" onClick={onClear} className="font-body text-sm font-semibold text-rose-deep">
            Clear all
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pt-4 pb-4">
          <Group label="Opened the invite">
            <Segmented
              value={f.status}
              options={[
                ["any", "Any"],
                ["opened", "Opened"],
                ["not-opened", "Didn't open"],
              ]}
              onChange={(status) => onChange({ status })}
            />
          </Group>

          <Group label="Visitor">
            <Segmented
              value={f.visitor}
              options={[
                ["any", "Any"],
                ["new", "First visit"],
                ["returning", "Came back"],
              ]}
              onChange={(visitor) => onChange({ visitor })}
            />
          </Group>

          <Group label="Did">
            <div className="flex gap-2">
              <Toggle on={f.rsvp} onClick={() => onChange({ rsvp: !f.rsvp })}>
                💌 RSVP&apos;d
              </Toggle>
              <Toggle on={f.wish} onClick={() => onChange({ wish: !f.wish })}>
                🏮 Left a wish
              </Toggle>
            </div>
          </Group>

          <Group label="Time spent">
            <Segmented
              value={String(f.minSeconds)}
              options={[
                ["0", "Any"],
                ["30", "30s+"],
                ["60", "1 min+"],
                ["300", "5 min+"],
              ]}
              onChange={(v) => onChange({ minSeconds: Number(v) as VisitFilters["minSeconds"] })}
            />
          </Group>

          <Group label="Read at least to">
            <Select
              value={f.reached}
              onChange={(reached) => onChange({ reached: reached as VisitFilters["reached"] })}
              options={SECTIONS.map((s) => [s, SECTION_NAMES[s]])}
            />
          </Group>

          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            <Group label="Town">
              <Select value={f.city} onChange={(city) => onChange({ city })} options={(options?.city ?? []).map((c) => [c, c])} />
            </Group>
            <Group label="Country">
              <Select
                value={f.country}
                onChange={(country) => onChange({ country })}
                options={(options?.country ?? []).map((c) => [c, countryName(c)])}
              />
            </Group>
            <Group label="Device">
              <Select
                value={f.device}
                onChange={(device) => onChange({ device })}
                options={(options?.device ?? []).map((d) => [d, DEVICE_NAMES[d] ?? d])}
              />
            </Group>
            <Group label="Browser">
              <Select
                value={f.browser}
                onChange={(browser) => onChange({ browser })}
                options={(options?.browser ?? []).map((b) => [b, b])}
              />
            </Group>
          </div>

          <Group label="How they found it">
            <Select value={f.source} onChange={(source) => onChange({ source })} options={(options?.source ?? []).map((s) => [s, s])} />
          </Group>
        </div>

        <div className="border-t border-ink/8 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-2xl bg-ink font-body text-base font-semibold text-white active:scale-[0.98]"
          >
            {loading || total === null ? "Show visits" : `Show ${total} ${total === 1 ? "visit" : "visits"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 font-body text-xs font-semibold tracking-wide text-ink/55 uppercase">{label}</p>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col rounded-2xl bg-ink/6 p-1">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={`h-10 rounded-xl px-1 font-body text-sm font-semibold transition-colors ${
            value === id ? "bg-white text-ink shadow-sm" : "text-ink/55"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`h-10 flex-1 rounded-2xl font-body text-sm font-semibold transition-colors ${
        on ? "bg-rose text-white" : "bg-ink/6 text-ink/65"
      }`}
    >
      {children}
    </button>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative flex h-11 items-center rounded-2xl bg-ink/6 pr-8 pl-3.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none truncate bg-transparent font-body text-sm font-semibold outline-none ${
          value ? "text-ink" : "text-ink/55"
        }`}
      >
        <option value="">Any</option>
        {options.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <Chevron />
    </label>
  );
}

const Chevron = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="pointer-events-none absolute right-3 size-4 text-ink/45"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const FilterIcon = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 5h18M6 12h12M10 19h4" />
  </svg>
);
