"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AdminShell,
  ConfirmSheet,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  PinIcon,
  SearchIcon,
  TrashIcon,
  useToast,
} from "@/components/admin/AdminShell";
import { MAX_PINNED } from "@/lib/wish-rules";
import type { AdminWish } from "@/lib/wishes-store";

type Filter = "all" | "public" | "pinned" | "private" | "hidden";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "public", label: "On the wall" },
  { id: "pinned", label: "Pinned" },
  { id: "private", label: "Private" },
  { id: "hidden", label: "Hidden" },
];

const HINTS: Partial<Record<Filter, string>> = {
  pinned: `Pinned wishes keep their lantern in the sky however many new wishes arrive — up to ${MAX_PINNED} at a time.`,
  private: "Only you two can see these. They never appear on the wall.",
  hidden: "Hidden wishes are off the wall. Show one again, or delete it for good.",
};

const matches = (w: AdminWish, f: Filter) =>
  f === "all" ? true : f === "hidden" ? w.hidden : f === "pinned" ? w.pinned : w.visibility === f && !w.hidden;

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return relative.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return relative.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 7 * 86400) return relative.format(-Math.floor(seconds / 86400), "day");
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type Pending = { kind: "delete"; wish: AdminWish } | { kind: "delete-all" };

export function WishesAdmin({ adminKey }: { adminKey: string }) {
  const [wishes, setWishes] = useState<AdminWish[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const toast = useToast();
  const api = `/api/wishes/admin?key=${encodeURIComponent(adminKey)}`;

  const load = useCallback(() => {
    return fetch(api)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setWishes(data.wishes);
        setError("");
      })
      .catch(() => setError("Not found — check the key in the link."))
      .finally(() => setRefreshing(false));
  }, [api]);

  function refresh() {
    setRefreshing(true);
    load();
  }

  useEffect(() => {
    load();
  }, [load]);

  async function send(method: "PATCH" | "DELETE", body: object) {
    const res = await fetch(api, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) return true;
    const data = await res?.json().catch(() => null);
    toast.show(data?.error ?? "That didn't work — check your connection and try again.", "error");
    return false;
  }

  async function toggleHidden(wish: AdminWish) {
    setBusy(wish.id);
    if (await send("PATCH", { id: wish.id, hidden: !wish.hidden })) {
      // Hiding a wish also unpins it (the API does the same).
      setWishes(
        (all) =>
          all?.map((w) => (w.id === wish.id ? { ...w, hidden: !w.hidden, pinned: w.hidden ? w.pinned : false } : w)) ??
          null,
      );
      toast.show(wish.hidden ? "Back on the wall" : "Hidden from the wall");
    }
    setBusy(null);
  }

  async function togglePinned(wish: AdminWish) {
    setBusy(wish.id);
    if (await send("PATCH", { id: wish.id, pinned: !wish.pinned })) {
      setWishes((all) => all?.map((w) => (w.id === wish.id ? { ...w, pinned: !w.pinned } : w)) ?? null);
      toast.show(wish.pinned ? "Unpinned" : "Pinned to the sky");
    }
    setBusy(null);
  }

  async function confirmDelete() {
    if (!pending) return;
    const wish = pending.kind === "delete" ? pending.wish : null;
    setPending(null);
    setBusy(wish?.id ?? "all-hidden");
    if (await send("DELETE", wish ? { id: wish.id } : { allHidden: true })) {
      const gone = (wishes ?? []).filter((w) => (wish ? w.id === wish.id : w.hidden)).length;
      setWishes((all) => all?.filter((w) => (wish ? w.id !== wish.id : !w.hidden)) ?? null);
      toast.show(gone === 1 ? "Wish deleted" : `${gone} wishes deleted`);
    }
    setBusy(null);
  }

  const all = wishes ?? [];
  const count = (f: Filter) => all.filter((w) => matches(w, f)).length;
  const needle = query.trim().toLowerCase();
  const shown = all.filter(
    (w) => matches(w, filter) && (!needle || `${w.name}\n${w.message}`.toLowerCase().includes(needle)),
  );
  const hiddenCount = count("hidden");

  const toolbar = wishes && (
    <div className="space-y-2.5">
      <label className="flex h-11 items-center gap-2 rounded-2xl bg-white px-3.5 text-ink/45 shadow-sm focus-within:ring-2 focus-within:ring-rose/40">
        <SearchIcon />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names or wishes"
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
              {id === "pinned" ? `${count(id)}/${MAX_PINNED}` : count(id)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <AdminShell tab="wishes" adminKey={adminKey} onRefresh={refresh} refreshing={refreshing} toolbar={toolbar}>
      {error && <Notice>{error}</Notice>}
      {!error && !wishes && <Notice>Loading wishes…</Notice>}

      {wishes && (
        <>
          {HINTS[filter] && <p className="mb-3 px-1 font-body text-xs leading-relaxed text-ink/55">{HINTS[filter]}</p>}

          {filter === "hidden" && hiddenCount > 1 && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setPending({ kind: "delete-all" })}
              className="mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-deep/30 bg-rose-deep/8 font-body text-sm font-semibold text-rose-deep disabled:opacity-50"
            >
              <TrashIcon />
              Delete all {hiddenCount} hidden wishes
            </button>
          )}

          {shown.length === 0 ? (
            <Notice>{needle ? `No wishes match “${query.trim()}”.` : "Nothing here yet."}</Notice>
          ) : (
            <ul className="space-y-3">
              {shown.map((wish) => (
                <WishCard
                  key={wish.id}
                  wish={wish}
                  busy={busy === wish.id || busy === "all-hidden"}
                  onPin={() => togglePinned(wish)}
                  onHide={() => toggleHidden(wish)}
                  onDelete={() => setPending({ kind: "delete", wish })}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {pending && (
        <ConfirmSheet
          title={
            pending.kind === "delete"
              ? `Delete ${pending.wish.name}'s wish?`
              : `Delete all ${hiddenCount} hidden wishes?`
          }
          body="It's removed for good, from the site and the Google Sheet. This can't be undone."
          confirmLabel={pending.kind === "delete" ? "Delete wish" : `Delete ${hiddenCount} wishes`}
          onConfirm={confirmDelete}
          onCancel={() => setPending(null)}
        />
      )}
      {toast.element}
    </AdminShell>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-white/60 px-4 py-8 text-center font-body text-sm text-ink/55">{children}</p>;
}

const LONG = 280;

function WishCard({
  wish,
  busy,
  onPin,
  onHide,
  onDelete,
}: {
  wish: AdminWish;
  busy: boolean;
  onPin: () => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = wish.message.length > LONG || wish.message.split("\n").length > 5;
  const isPublic = wish.visibility === "public";

  return (
    <li className={`overflow-hidden rounded-3xl bg-white shadow-sm ${wish.hidden ? "ring-1 ring-ink/10" : ""}`}>
      <div className={`p-4 ${wish.hidden ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 flex-shrink-0 place-items-center rounded-full bg-rose/12 font-body text-base font-bold text-rose-deep"
          >
            {[...wish.name.trim()][0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-body text-[15px] font-bold text-ink">{wish.name}</p>
              <time
                dateTime={wish.createdAt}
                title={new Date(wish.createdAt).toLocaleString("en-IN")}
                className="flex-shrink-0 font-body text-xs text-ink/45"
              >
                {ago(wish.createdAt)}
              </time>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {isPublic ? (
                <Tag tone={wish.hidden ? "muted" : "sky"}>{wish.hidden ? "Hidden" : "On the wall"}</Tag>
              ) : (
                <Tag tone="ink">
                  <LockIcon className="size-3" /> Private
                </Tag>
              )}
              {wish.pinned && (
                <Tag tone="rose">
                  <PinIcon className="size-3" /> Pinned
                </Tag>
              )}
              {wish.source === "rsvp" && <Tag tone="muted">From RSVP</Tag>}
            </div>
          </div>
        </div>

        <p
          className={`mt-3 whitespace-pre-line font-body text-[15px] leading-relaxed text-ink/85 [overflow-wrap:anywhere] ${
            isLong && !expanded ? "line-clamp-5" : ""
          }`}
        >
          {wish.message}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 -ml-1 px-1 py-1.5 font-body text-sm font-semibold text-rose-deep"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {isPublic && (
        <div className="grid auto-cols-fr grid-flow-col gap-px border-t border-ink/8 bg-ink/8">
          {!wish.hidden && (
            <Action onClick={onPin} disabled={busy} active={wish.pinned}>
              <PinIcon /> {wish.pinned ? "Unpin" : "Pin"}
            </Action>
          )}
          <Action onClick={onHide} disabled={busy}>
            {wish.hidden ? (
              <>
                <EyeIcon /> Show again
              </>
            ) : (
              <>
                <EyeOffIcon /> Hide
              </>
            )}
          </Action>
          {wish.hidden && (
            <Action onClick={onDelete} disabled={busy} danger>
              <TrashIcon /> Delete
            </Action>
          )}
        </div>
      )}
    </li>
  );
}

function Tag({ tone, children }: { tone: "sky" | "rose" | "ink" | "muted"; children: ReactNode }) {
  const tones = {
    sky: "bg-sky-top/25 text-dusk-deep",
    rose: "bg-rose/12 text-rose-deep",
    ink: "bg-ink/8 text-ink/70",
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

function Action({
  onClick,
  disabled,
  active = false,
  danger = false,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 items-center justify-center gap-1.5 bg-white font-body text-sm font-semibold transition-colors active:bg-cream disabled:opacity-40 ${
        danger ? "text-rose-deep" : active ? "text-rose" : "text-ink/70"
      }`}
    >
      {children}
    </button>
  );
}
