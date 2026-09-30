"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
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

const VIEWPORT = { once: true, margin: "-60px" } as const;
const HEART_COLORS = ["#c1594a", "#e6a99b", "#f6d9ce", "#fdfbf3", "#ffcf7a"];

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

// ── A wish's look: stable per wish (hashed from its id), varied across them ──

const PAPERS = ["#fffaf0", "#fdeee9", "#eaf4fb", "#eef4e8", "#fff4d9", "#f3eefb"];
const TAPES = ["rgba(193,89,74,0.55)", "rgba(140,164,196,0.6)", "rgba(95,122,82,0.45)", "rgba(255,207,122,0.75)"];
const AVATARS = ["#c1594a", "#5c7699", "#5f7a52", "#c98b3a", "#8a6fb3", "#a4483b"];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function lookFor(wish: PublicWish) {
  const h = hash(wish.id);
  return {
    paper: PAPERS[h % PAPERS.length],
    tape: TAPES[(h >>> 3) % TAPES.length],
    avatar: AVATARS[hash(wish.name.toLowerCase()) % AVATARS.length],
    tilt: (((h >>> 6) % 25) - 12) / 10, // -1.2° … 1.2°
    tapeTilt: (((h >>> 11) % 9) - 4) * 1.2,
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

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
  const look = lookFor(wish);
  return (
    // The <li> does the entrance (compositor-only transform/opacity); the
    // card inside keeps its own resting tilt.
    <li className="wish-in" style={{ animationDelay: `${Math.min(order, 7) * 70}ms` }}>
      <article
        className={`relative rounded-2xl px-5 pt-6 pb-4 shadow-[0_14px_30px_-18px_rgba(30,42,68,0.45)] ${fresh ? "wish-fresh" : ""}`}
        style={{ background: look.paper, transform: `rotate(${look.tilt}deg)` } as CSSProperties}
      >
        <span
          aria-hidden
          className="absolute -top-2.5 h-5 w-16 rounded-[2px]"
          style={{
            background: `repeating-linear-gradient(90deg, ${look.tape} 0 6px, transparent 6px 9px), ${look.tape}`,
            transform: `translateX(-50%) rotate(${look.tapeTilt}deg)`,
            left: "50%",
          }}
        />
        <span aria-hidden className="pointer-events-none absolute top-1 left-3 font-display text-6xl leading-none text-ink/10">
          &ldquo;
        </span>
        <p className="relative whitespace-pre-line font-hand text-[1.35rem] leading-snug text-ink/85 [overflow-wrap:anywhere]">
          {wish.message}
        </p>
        <footer className="mt-3 flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-body text-[11px] font-bold text-white"
            style={{ background: look.avatar }}
          >
            {initials(wish.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-body text-sm font-semibold text-ink">{wish.name}</span>
            <time dateTime={wish.createdAt} className="block font-body text-[11px] text-ink/45">
              {when(wish.createdAt, now)}
            </time>
          </span>
          <HeartIcon className="h-4 w-4 flex-shrink-0 text-rose/70" />
        </footer>
      </article>
    </li>
  );
}

function SkeletonCard() {
  return (
    <li className="animate-pulse rounded-2xl bg-white/60 px-5 pt-6 pb-4" aria-hidden>
      <div className="h-4 w-11/12 rounded bg-ink/10" />
      <div className="mt-2.5 h-4 w-3/4 rounded bg-ink/10" />
      <div className="mt-4 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-ink/10" />
        <div className="h-3 w-24 rounded bg-ink/10" />
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
        setServerError(data.error ?? "Could not send your wish. Please try again.");
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
          speed: 520,
          shapes: ["heart", "petal"],
          colors: HEART_COLORS,
          size: [6, 12],
          life: 2.4,
        });
      }
      haptic([10, 30, 16]);
      setSentAs(visibility);
      setMessage("");
      startedAt.current = null;
      setStatus("sent");
    } catch {
      setServerError("Could not send your wish. Please check your connection and try again.");
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
      className="space-y-4 rounded-3xl border border-ink/10 bg-white/75 p-5 text-left shadow-[var(--card-shadow)]"
    >
      <div>
        <label htmlFor="wish-name" className="font-body text-sm font-bold text-ink">
          Your Name <span className="text-rose">*</span>
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
          className={`mt-1.5 w-full rounded-xl border bg-white/85 px-3.5 py-3 font-body text-sm text-ink placeholder:text-ink/35 focus:border-rose focus:outline-none ${
            errors.name ? "border-rose-deep" : "border-ink/15"
          }`}
        />
        {errors.name && (
          <p id="wish-name-error" role="alert" className="mt-1 font-body text-xs text-rose-deep">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="wish-message" className="font-body text-sm font-bold text-ink">
          Your Wish <span className="text-rose">*</span>
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
            className={`wish-lines w-full resize-none rounded-xl border px-3.5 pt-2 pb-6 font-hand text-xl leading-8 text-ink placeholder:text-ink/35 focus:border-rose focus:outline-none ${
              errors.message ? "border-rose-deep" : "border-ink/15"
            }`}
          />
          <span
            id="wish-count"
            className={`pointer-events-none absolute right-3 bottom-2 font-body text-[10px] tabular-nums ${
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

      <fieldset>
        <legend className="font-body text-sm font-bold text-ink">Who can see it?</legend>
        <div role="radiogroup" aria-label="Who can see your wish" className="relative mt-1.5 grid grid-cols-2 rounded-full bg-ink/[0.06] p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-out"
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
              className={`relative flex items-center justify-center gap-1.5 rounded-full py-2.5 font-body text-xs font-bold transition-colors ${
                visibility === value ? "text-rose-deep" : "text-ink/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <p
          key={visibility}
          className={`wish-note mt-2.5 flex gap-2 rounded-xl px-3 py-2.5 font-body text-xs leading-relaxed ${
            isPublic ? "border border-[#f1d08a] bg-[#fff6e0] text-[#7a5a17]" : "border border-dusk/25 bg-dusk/10 text-ink/70"
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
        {status === "sending" ? "Sending..." : isPublic ? "Post your wish" : "Send privately"}
        {status !== "sending" && <HeartIcon className="h-4 w-4" />}
      </button>

      <div aria-live="polite" className="min-h-0">
        {status === "sent" && (
          <p className="wish-note text-center font-hand text-xl text-rose-deep">
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
  // never disturb the "Read more" cursor, which only ever points at the
  // oldest wish loaded.
  const refresh = useCallback(async () => {
    lastRefresh.current = Date.now();
    setState((s) => (s === "ready" ? s : "loading"));
    try {
      const page = await fetchPage(null);
      setWishes((current) => merge(current, page.wishes));
      // Only the first load sets the "Read more" cursor; later refreshes just
      // add newer wishes on top and leave it pointing at the oldest one.
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
          {!!total && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-1.5 font-body text-xs font-semibold text-rose-deep shadow-sm">
              <HeartIcon className="h-3.5 w-3.5" />
              {total} {total === 1 ? "wish" : "wishes"} and counting
            </p>
          )}
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

        <div className="mt-10">
          {state === "error" && wishes.length === 0 ? (
            <div className="text-center">
              <p className="font-body text-sm text-ink/60">Couldn&apos;t load the wishes just now.</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-3 rounded-full border-2 border-rose/30 bg-white/70 px-5 py-2 font-body text-xs font-bold text-rose-deep"
              >
                Try again
              </button>
            </div>
          ) : state === "ready" && wishes.length === 0 ? (
            <p className="text-center font-hand text-2xl text-ink/55">{wedding.wishes.empty}</p>
          ) : (
            <ul aria-label="Wishes from friends and family" aria-busy={state === "loading"} className="space-y-6">
              {wishes.length === 0
                ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
                : wishes.map((wish, i) => (
                    <WishCard key={wish.id} wish={wish} now={now} order={i % 8} fresh={freshIds.has(wish.id)} />
                  ))}
            </ul>
          )}

          {cursor && wishes.length > 0 && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full border-2 border-rose/30 bg-white/70 px-6 py-3 font-body text-sm font-bold text-rose-deep shadow-sm transition hover:bg-white active:scale-[0.98] disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : `Read more wishes${remaining ? ` (${remaining})` : ""}`}
              </button>
              {moreError && (
                <p role="alert" className="mt-2 font-body text-xs text-rose-deep">
                  Couldn&apos;t load more. Tap to try again.
                </p>
              )}
            </div>
          )}
          {!cursor && state === "ready" && wishes.length > 0 && (
            <p className="mt-8 text-center font-hand text-xl text-ink/55">{wedding.wishes.end}</p>
          )}
        </div>
      </div>
    </section>
  );
}
