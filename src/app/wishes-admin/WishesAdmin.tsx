"use client";

import { useEffect, useState } from "react";
import { MAX_PINNED } from "@/lib/wish-rules";
import type { AdminWish } from "@/lib/wishes-store";

type Filter = "all" | "pinned" | "public" | "private" | "hidden";

const matches = (w: AdminWish, f: Filter) =>
  f === "all" ? true : f === "hidden" ? w.hidden : f === "pinned" ? w.pinned : w.visibility === f && !w.hidden;

export function WishesAdmin({ adminKey }: { adminKey: string }) {
  const [wishes, setWishes] = useState<AdminWish[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const api = `/api/wishes/admin?key=${encodeURIComponent(adminKey)}`;

  useEffect(() => {
    fetch(api)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setWishes(data.wishes))
      .catch(() => setError("Not found — check the key in the link."));
  }, [api]);

  async function toggleHidden(wish: AdminWish) {
    setBusy(wish.id);
    const res = await fetch(api, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: wish.id, hidden: !wish.hidden }),
    }).catch(() => null);
    if (res?.ok) {
      // Hiding a wish also unpins it (the API does the same).
      setWishes(
        (all) =>
          all?.map((w) => (w.id === wish.id ? { ...w, hidden: !w.hidden, pinned: w.hidden ? w.pinned : false } : w)) ??
          null
      );
    } else {
      alert("Couldn't update that wish. Please try again.");
    }
    setBusy(null);
  }

  async function togglePinned(wish: AdminWish) {
    setBusy(wish.id);
    const res = await fetch(api, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: wish.id, pinned: !wish.pinned }),
    }).catch(() => null);
    if (res?.ok) {
      setWishes((all) => all?.map((w) => (w.id === wish.id ? { ...w, pinned: !w.pinned } : w)) ?? null);
    } else {
      const data = await res?.json().catch(() => null);
      alert(data?.error ?? "Couldn't update that wish. Please try again.");
    }
    setBusy(null);
  }

  /** Deletes one hidden wish for good, or every hidden one when `wish` is null. */
  async function deleteHidden(wish: AdminWish | null) {
    const hiddenCount = (wishes ?? []).filter((w) => w.hidden).length;
    const question = wish
      ? `Delete ${wish.name}'s wish for good? This can't be undone.`
      : `Delete all ${hiddenCount} hidden wishes for good? This can't be undone.`;
    if (!confirm(question)) return;
    setBusy(wish?.id ?? "all-hidden");
    const res = await fetch(api, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wish ? { id: wish.id } : { allHidden: true }),
    }).catch(() => null);
    if (res?.ok) {
      setWishes((all) => all?.filter((w) => (wish ? w.id !== wish.id : !w.hidden)) ?? null);
    } else {
      const data = await res?.json().catch(() => null);
      alert(data?.error ?? "Couldn't delete. Please try again.");
    }
    setBusy(null);
  }

  const shown = (wishes ?? []).filter((w) => matches(w, filter));
  const count = (f: Filter) => (wishes ?? []).filter((w) => matches(w, f)).length;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-hand text-4xl text-ink">Wishes &amp; Blessings</h1>
        <a
          href={`/analytics-admin?key=${encodeURIComponent(adminKey)}`}
          className="font-body text-xs font-semibold text-rose-deep underline underline-offset-2"
        >
          Visitors →
        </a>
      </div>
      <p className="mt-1 font-body text-sm text-ink/60">
        Every wish, including private ones. Hiding a public wish takes it off the wall within about 10 seconds.
        Pinning one keeps its lantern in the sky for good, however many new wishes arrive — up to {MAX_PINNED}{" "}
        at a time. A wish has to be hidden before it can be deleted for good.
      </p>

      {error && <p className="mt-6 font-body text-sm text-rose-deep">{error}</p>}
      {!error && !wishes && <p className="mt-6 font-body text-sm text-ink/50">Loading...</p>}

      {wishes && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {(["all", "pinned", "public", "private", "hidden"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 font-body text-xs font-bold capitalize ${
                  filter === f ? "bg-rose text-white" : "bg-white text-ink/60"
                }`}
              >
                {f} ({f === "pinned" ? `${count(f)} of ${MAX_PINNED}` : count(f)})
              </button>
            ))}
          </div>

          {filter === "hidden" && count("hidden") > 0 && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => deleteHidden(null)}
              className="mt-4 rounded-full bg-rose-deep px-4 py-2 font-body text-xs font-bold text-white disabled:opacity-50"
            >
              Delete all {count("hidden")} hidden for good
            </button>
          )}

          <ul className="mt-6 space-y-3">
            {shown.map((wish) => (
              <li
                key={wish.id}
                className={`rounded-2xl bg-white p-4 shadow-sm ${wish.hidden ? "opacity-55" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-body text-sm font-bold text-ink">{wish.name}</p>
                    <p className="font-body text-[11px] text-ink/45">
                      {new Date(wish.createdAt).toLocaleString("en-IN")} ·{" "}
                      {wish.visibility === "private" ? "🔒 private" : "🌍 public"}
                      {wish.source === "rsvp" && " · from RSVP"}
                      {wish.hidden && " · hidden"}
                      {wish.pinned && " · 📌 pinned"}
                    </p>
                  </div>
                  {wish.visibility === "public" && (
                    <div className="flex flex-shrink-0 gap-2">
                      {!wish.hidden && (
                        <button
                          type="button"
                          disabled={busy === wish.id}
                          onClick={() => togglePinned(wish)}
                          className={`rounded-full border px-3 py-1 font-body text-xs font-semibold disabled:opacity-50 ${
                            wish.pinned ? "border-rose bg-rose text-white" : "border-ink/15 text-ink/70"
                          }`}
                        >
                          {wish.pinned ? "Unpin" : "Pin"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy === wish.id}
                        onClick={() => toggleHidden(wish)}
                        className="rounded-full border border-ink/15 px-3 py-1 font-body text-xs font-semibold text-ink/70 disabled:opacity-50"
                      >
                        {wish.hidden ? "Show again" : "Hide"}
                      </button>
                      {wish.hidden && (
                        <button
                          type="button"
                          disabled={busy === wish.id}
                          onClick={() => deleteHidden(wish)}
                          className="rounded-full border border-rose-deep bg-rose-deep px-3 py-1 font-body text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line font-body text-sm text-ink/80 [overflow-wrap:anywhere]">
                  {wish.message}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
