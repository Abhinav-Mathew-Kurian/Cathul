"use client";

import { useEffect, useState } from "react";
import type { AdminWish } from "@/lib/wishes-store";

type Filter = "all" | "public" | "private" | "hidden";

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
      setWishes((all) => all?.map((w) => (w.id === wish.id ? { ...w, hidden: !w.hidden } : w)) ?? null);
    } else {
      alert("Couldn't update that wish. Please try again.");
    }
    setBusy(null);
  }

  const shown = (wishes ?? []).filter((w) =>
    filter === "all" ? true : filter === "hidden" ? w.hidden : w.visibility === filter && !w.hidden
  );
  const count = (f: Filter) =>
    (wishes ?? []).filter((w) => (f === "all" ? true : f === "hidden" ? w.hidden : w.visibility === f && !w.hidden))
      .length;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <h1 className="font-hand text-4xl text-ink">Wishes &amp; Blessings</h1>
      <p className="mt-1 font-body text-sm text-ink/60">
        Every wish, including private ones. Hiding a public wish takes it off the wall within about 10 seconds.
      </p>

      {error && <p className="mt-6 font-body text-sm text-rose-deep">{error}</p>}
      {!error && !wishes && <p className="mt-6 font-body text-sm text-ink/50">Loading...</p>}

      {wishes && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {(["all", "public", "private", "hidden"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 font-body text-xs font-bold capitalize ${
                  filter === f ? "bg-rose text-white" : "bg-white text-ink/60"
                }`}
              >
                {f} ({count(f)})
              </button>
            ))}
          </div>

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
                    </p>
                  </div>
                  {wish.visibility === "public" && (
                    <button
                      type="button"
                      disabled={busy === wish.id}
                      onClick={() => toggleHidden(wish)}
                      className="flex-shrink-0 rounded-full border border-ink/15 px-3 py-1 font-body text-xs font-semibold text-ink/70 disabled:opacity-50"
                    >
                      {wish.hidden ? "Show again" : "Hide"}
                    </button>
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
