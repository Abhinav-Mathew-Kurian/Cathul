"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { wedding } from "@/content/wedding";
import { burst, haptic } from "@/lib/burst";
import {
  cleanText,
  MESSAGE_MAX,
  NAME_MAX,
  validateWish,
  type PublicWish,
  type WishVisibility,
} from "@/lib/wish-rules";
import { HeartIcon } from "./doodles";
import { BeatingHeart } from "./BeatingHeart";
import { FallingPetals } from "./FallingPetals";
import { StringLights } from "./StringLights";

// The wall is a jasmine garland — mulla poo, as worn at every Kerala wedding
// — with each wish hanging off it on a thread, woven as a strip of kasavu:
// off-white handloom with a gold zari border. See the .garland / .kasavu
// rules in globals.css for the textiles themselves.

const VIEWPORT = { once: true, margin: "-60px" } as const;
const BLOOM_COLORS = ["#fffdf6", "#f6ecd2", "#e2c27a", "#c9a04e", "#f6d9ce"];

type Page = { wishes: PublicWish[]; nextCursor: string | null; total?: number };

async function fetchPage(cursor: string | null): Promise<Page> {
  const res = await fetch(cursor ? `/api/wishes?cursor=${encodeURIComponent(cursor)}` : "/api/wishes");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

/**
 * Union of two lists by id, in the API's own order (newest first, id as the
 * tie-break) — correct whichever order pages, refreshes and the guest's own
 * new wish happen to arrive in.
 */
function merge(current: PublicWish[], incoming: PublicWish[]) {
  const byId = new Map(current.map((w) => [w.id, w]));
  let added = false;
  for (const w of incoming) {
    if (!byId.has(w.id)) {
      byId.set(w.id, w);
      added = true;
    }
  }
  if (!added) return current;
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (a.id < b.id ? 1 : -1));
}

// Each wish gets its own border weave and a slight hang, stable per wish.
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const BORDERS = ["kasavu-band", "kasavu-lines", "kasavu-temple"] as const;

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function when(iso: string, now: number) {
  const seconds = (now - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return relative.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return relative.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 7 * 86400) return relative.format(-Math.floor(seconds / 86400), "day");
  return dateOnly.format(new Date(iso));
}

function WishCard({ wish, now, order, fresh }: { wish: PublicWish; now: number; order: number; fresh: boolean }) {
  const h = hash(wish.id);
  const tilt = (((h >>> 4) % 17) - 8) / 10; // -0.8° … 0.8°, hanging from its thread
  return (
    <li
      className={`wish ${fresh ? "wish-drop" : "wish-in"}`}
      style={fresh ? undefined : { animationDelay: `${Math.min(order, 7) * 60}ms` }}
    >
      <span aria-hidden className="wish-knot" />
      <div className={fresh ? "wish-swing" : undefined}>
        <article className={`kasavu ${BORDERS[h % BORDERS.length]}`} style={{ transform: `rotate(${tilt}deg)` }}>
          <p className="whitespace-pre-line font-hand text-[1.4rem] leading-[1.3] text-ink/85 [overflow-wrap:anywhere]">
            {wish.message}
          </p>
          <footer className="mt-2 flex items-end justify-between gap-3">
            <span className="min-w-0 truncate font-script text-[1.75rem] leading-none text-[#8a6a28]">{wish.name}</span>
            <time dateTime={wish.createdAt} className="flex-shrink-0 pb-0.5 font-body text-[11px] text-ink/40">
              {when(wish.createdAt, now)}
            </time>
          </footer>
        </article>
      </div>
    </li>
  );
}

function SkeletonCard() {
  return (
    <li className="wish" aria-hidden>
      <span className="wish-knot" />
      <div className="kasavu kasavu-lines animate-pulse">
        <div className="h-4 w-11/12 rounded-sm bg-[#e9dfc4]/70" />
        <div className="mt-2.5 h-4 w-3/5 rounded-sm bg-[#e9dfc4]/70" />
        <div className="mt-4 h-5 w-28 rounded-sm bg-[#e9dfc4]/60" />
      </div>
    </li>
  );
}

// ── The form ────────────────────────────────────────────────────────────────

function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </svg>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

type Status = "idle" | "sending" | "sent" | "error";

function WishForm({ onPosted }: { onPosted: (wish: PublicWish) => void }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<WishVisibility>("public");
  const [errors, setErrors] = useState<Partial<Record<"name" | "message", string>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState("");
  const [sentAs, setSentAs] = useState<WishVisibility>("public");
  const startedAt = useRef<number | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const markStarted = () => {
    startedAt.current ??= performance.now();
  };
  // Any edit after sending clears the old "sent"/error line, so it can never
  // describe a different wish than the one on screen.
  const edited = () => {
    if (status === "sent" || status === "error") setStatus("idle");
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const clean = {
      name: cleanText(name, NAME_MAX, false),
      message: cleanText(message, MESSAGE_MAX, true),
      visibility,
    };
    const nextErrors = validateWish(clean);
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clean,
          website: honeypot.current?.value ?? "",
          elapsedMs: startedAt.current === null ? 0 : performance.now() - startedAt.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setServerError(data.error ?? "Your wish didn't send. Please try again.");
        setStatus("error");
        return;
      }
      if (data.wish) onPosted(data.wish);
      const origin = submitRef.current?.getBoundingClientRect();
      if (origin) {
        burst({
          x: origin.left + origin.width / 2,
          y: origin.top,
          count: 26,
          speed: 480,
          shapes: ["petal", "petal", "heart"],
          colors: BLOOM_COLORS,
          size: [6, 12],
          life: 2.6,
        });
      }
      haptic([10, 30, 16]);
      setSentAs(visibility);
      setMessage("");
      startedAt.current = null;
      setStatus("sent");
    } catch {
      setServerError("Your wish didn't send. Check your connection and try again.");
      setStatus("error");
    }
  }

  const count = message.length;
  const isPublic = visibility === "public";

  return (
    <form
      onSubmit={handleSubmit}
      onFocusCapture={markStarted}
      noValidate
      className="kasavu kasavu-band kasavu-form space-y-5 text-left"
    >
      <div>
        <label htmlFor="wish-message" className="font-body text-sm font-bold text-ink">
          Your wish
        </label>
        <div className="relative mt-1.5">
          <textarea
            id="wish-message"
            rows={4}
            maxLength={MESSAGE_MAX}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              edited();
            }}
            placeholder={wedding.wishes.placeholder}
            aria-invalid={!!errors.message}
            aria-describedby={`wish-count${errors.message ? " wish-message-error" : ""}`}
            className={`w-full resize-none rounded-sm border bg-white/70 px-3 pt-2 pb-6 font-hand text-[1.35rem] leading-8 text-ink placeholder:text-ink/35 focus:border-[#c9a04e] focus:outline-none focus:ring-2 focus:ring-[#c9a04e]/25 ${
              errors.message ? "border-rose-deep" : "border-[#e6d8b3]"
            }`}
          />
          <span
            id="wish-count"
            className={`pointer-events-none absolute right-2.5 bottom-1.5 font-body text-[10px] tabular-nums ${
              count > MESSAGE_MAX - 40 ? "text-rose-deep" : "text-ink/35"
            }`}
          >
            {count}/{MESSAGE_MAX}
          </span>
        </div>
        {errors.message && (
          <p id="wish-message-error" role="alert" className="mt-1 font-body text-xs text-rose-deep">
            {errors.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="wish-name" className="font-body text-sm font-bold text-ink">
          Signed by
        </label>
        <input
          id="wish-name"
          type="text"
          autoComplete="name"
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            edited();
          }}
          placeholder="Your name"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "wish-name-error" : undefined}
          className={`mt-0.5 w-full border-0 border-b bg-transparent px-0 pt-1 pb-1.5 font-script text-[1.9rem] leading-tight text-[#8a6a28] placeholder:font-body placeholder:text-sm placeholder:text-ink/35 focus:outline-none focus:ring-0 ${
            errors.name ? "border-rose-deep" : "border-[#d9c38f] focus:border-[#c9a04e]"
          }`}
        />
        {errors.name && (
          <p id="wish-name-error" role="alert" className="mt-1 font-body text-xs text-rose-deep">
            {errors.name}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="font-body text-sm font-bold text-ink">Who can read it</legend>
        <div role="radiogroup" aria-label="Who can read your wish" className="relative mt-1.5 grid grid-cols-2 rounded-full bg-[#efe4c7]/70 p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-[0_1px_0_rgba(201,160,78,0.45),0_2px_6px_-2px_rgba(80,60,20,0.25)] transition-transform duration-300 ease-out"
            style={{ transform: isPublic ? "translateX(0)" : "translateX(100%)" }}
          />
          {(
            [
              { value: "public", label: "Everyone", Icon: GlobeIcon },
              { value: "private", label: "Only the couple", Icon: LockIcon },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={visibility === value}
              onClick={() => {
                setVisibility(value);
                setErrors((prev) => ({ ...prev, message: undefined }));
                edited();
              }}
              className={`relative flex items-center justify-center gap-1.5 rounded-full py-2.5 font-body text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a04e] ${
                visibility === value ? "text-[#8a6a28]" : "text-ink/45"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <p
          key={visibility}
          className={`wish-note mt-2.5 flex gap-2 rounded-sm px-3 py-2.5 font-body text-xs leading-relaxed ${
            isPublic ? "border border-[#ecd49c] bg-[#fff6e0] text-[#6e5316]" : "border border-dusk/25 bg-dusk/10 text-ink/70"
          }`}
        >
          {isPublic ? <GlobeIcon className="mt-px h-4 w-4 flex-shrink-0" /> : <LockIcon className="mt-px h-4 w-4 flex-shrink-0" />}
          <span>{isPublic ? wedding.wishes.publicWarning : wedding.wishes.privateNote}</span>
        </p>
      </fieldset>

      {/* Hidden from people; bots fill every field they find. */}
      <input
        ref={honeypot}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute h-px w-px overflow-hidden opacity-0"
        style={{ left: -9999 }}
      />

      <button
        ref={submitRef}
        type="submit"
        disabled={status === "sending"}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-rose py-4 font-body text-sm font-bold text-white shadow-[var(--card-shadow)] transition hover:bg-rose-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "sending" ? "Sending..." : isPublic ? "Add your wish to the garland" : "Send privately"}
        {status !== "sending" && <HeartIcon className="h-4 w-4" />}
      </button>

      <div aria-live="polite">
        {status === "sent" && (
          <p className="wish-note text-center font-hand text-xl text-[#8a6a28]">
            {sentAs === "public" ? wedding.wishes.sentPublic : wedding.wishes.sentPrivate}
          </p>
        )}
        {status === "error" && serverError && (
          <p role="alert" className="text-center font-body text-xs text-rose-deep">
            {serverError}
          </p>
        )}
      </div>
    </form>
  );
}

// ── The section ─────────────────────────────────────────────────────────────

type LoadState = "idle" | "loading" | "ready" | "error";

export function Wishes() {
  const [wishes, setWishes] = useState<PublicWish[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const sectionRef = useRef<HTMLElement>(null);
  const lastRefresh = useRef(0);
  const firstPageLoaded = useRef(false);
  // The ids on screen, for handlePosted to check without a nested setState.
  const shownIds = useRef(new Set<string>());
  useEffect(() => {
    shownIds.current = new Set(wishes.map((w) => w.id));
  }, [wishes]);

  // First page — and, when someone comes back to the wall a minute later,
  // any wishes posted since, slotted in on top. Keyset paging means these
  // never disturb the "show more" cursor, which only ever points at the
  // oldest wish loaded.
  const refresh = useCallback(async () => {
    lastRefresh.current = Date.now();
    setState((s) => (s === "ready" ? s : "loading"));
    try {
      const page = await fetchPage(null);
      setWishes((current) => merge(current, page.wishes));
      // Only the first load sets the cursor; later refreshes just add newer
      // wishes on top and leave it pointing at the oldest one.
      if (!firstPageLoaded.current) {
        firstPageLoaded.current = true;
        setCursor(page.nextCursor);
      }
      if (page.total !== undefined) setTotal(page.total);
      setNow(Date.now());
      setState("ready");
    } catch {
      setState((s) => (s === "ready" ? s : "error"));
    }
  }, []);

  // Starts loading well before the section scrolls into view (it's near the
  // end of a long page), so the wall is ready by the time anyone reaches it.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && Date.now() - lastRefresh.current > 60_000) refresh();
      },
      { rootMargin: "1200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [refresh]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await fetchPage(cursor);
      setWishes((current) => merge(current, page.wishes));
      setCursor(page.nextCursor);
      setNow(Date.now());
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function handlePosted(wish: PublicWish) {
    // A duplicate send comes back as the original wish — already counted.
    if (!shownIds.current.has(wish.id)) setTotal((t) => (t === null ? null : t + 1));
    setWishes((current) => merge(current, [wish]));
    setFreshIds((ids) => new Set(ids).add(wish.id));
    setNow(Date.now());
    setState("ready");
  }

  const remaining = total !== null ? Math.max(0, total - wishes.length) : null;
  const ended = !cursor && state === "ready";

  return (
    <section ref={sectionRef} id="wishes" className="wishes-bg relative overflow-hidden px-5 pt-16 pb-16">
      <StringLights seedOffset={700} />
      <FallingPetals count={6} seedOffset={700} className="absolute inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="flex items-center justify-center gap-2 font-hand text-4xl text-ink sm:text-5xl">
            {wedding.wishes.heading}
            <BeatingHeart className="h-5 w-5 text-rose" />
          </h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-ink/60">{wedding.wishes.subheading}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-8"
        >
          <WishForm onPosted={handlePosted} />
        </motion.div>

        {!!total && (
          <p className="mt-10 text-center font-hand text-2xl text-[#8a6a28]">
            {total} {total === 1 ? "wish" : "wishes"} on the garland
          </p>
        )}

        {state === "error" && wishes.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="font-body text-sm text-ink/60">The wishes didn&apos;t load.</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 rounded-full border border-[#d9c38f] bg-white/70 px-5 py-2 font-body text-xs font-bold text-[#8a6a28]"
            >
              Try again
            </button>
          </div>
        ) : state === "ready" && wishes.length === 0 ? (
          <div className="garland garland-empty mt-10">
            <span aria-hidden className="garland-flower" />
            <p className="font-hand text-2xl leading-snug text-ink/60">{wedding.wishes.empty}</p>
          </div>
        ) : (
          <div className="garland mt-6">
            <ul aria-label="Wishes from friends and family" aria-busy={state !== "ready"} className="space-y-7 pt-3">
              {wishes.length === 0
                ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
                : wishes.map((wish, i) => (
                    <WishCard key={wish.id} wish={wish} now={now} order={i % 8} fresh={freshIds.has(wish.id)} />
                  ))}
            </ul>
            {ended && wishes.length > 0 && <span aria-hidden className="garland-flower" />}
          </div>
        )}

        {cursor && wishes.length > 0 && (
          <div className="mt-7 pl-10">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-full border border-[#d9c38f] bg-[#fffdf6] px-5 py-2.5 font-body text-sm font-bold text-[#8a6a28] shadow-[0_6px_14px_-10px_rgba(80,60,20,0.5)] transition active:scale-[0.98] disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : `Show more wishes${remaining ? ` (${remaining} left)` : ""}`}
            </button>
            {moreError && (
              <p role="alert" className="mt-2 font-body text-xs text-rose-deep">
                More wishes didn&apos;t load. Tap to try again.
              </p>
            )}
          </div>
        )}
        {ended && wishes.length > 0 && (
          <p className="mt-3 pl-10 font-hand text-xl text-ink/50">{wedding.wishes.end}</p>
        )}
      </div>
    </section>
  );
}
