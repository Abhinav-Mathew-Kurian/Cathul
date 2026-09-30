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

// Guests write back to "A Note From Us" on pages torn from the same notepad:
// cream ruled paper, a torn top edge, handwriting on the lines, and a name
// signed in rose script — exactly how the couple signed theirs. The form is
// a blank page from that pad. See .wish-paper in globals.css.

const VIEWPORT = { once: true, margin: "-60px" } as const;
const HEART_COLORS = ["#c1594a", "#e6a99b", "#f6d9ce", "#fdfbf3", "#8ca4c4"];

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

// Stable per wish: each page sits at its own slight angle, with a rose or
// dusk-blue heart in the corner — the two heart colours of Our Story.
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
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
  const h = hash(wish.id);
  const tilt = (((h >>> 4) % 19) - 9) / 10; // -0.9° … 0.9°
  return (
    <li
      className={fresh ? "wish-land" : "wish-in"}
      style={fresh ? undefined : { animationDelay: `${Math.min(order, 7) * 60}ms` }}
    >
      <div className="wish-shadow">
        <article className="wish-paper torn-paper-top" style={{ transform: `rotate(${tilt}deg)` }}>
          <HeartIcon
            className={`absolute top-6 right-5 h-3.5 w-3.5 ${h % 2 ? "text-rose" : "text-dusk"}`}
          />
          <p className="wish-lines-text whitespace-pre-line pr-4 font-hand text-ink/85 [overflow-wrap:anywhere]">
            {wish.message}
          </p>
          <footer className="flex items-end justify-between gap-3">
            <span className="min-w-0 truncate font-script text-[2rem] leading-[2rem] text-rose-deep">{wish.name}</span>
            <time dateTime={wish.createdAt} className="flex-shrink-0 pb-1 font-body text-[11px] text-ink/40">
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
    <li aria-hidden>
      <div className="wish-shadow">
        <div className="wish-paper torn-paper-top animate-pulse">
          <div className="mt-3 h-3.5 w-11/12 rounded bg-ink/[0.07]" />
          <div className="mt-[1.3rem] h-3.5 w-3/5 rounded bg-ink/[0.07]" />
          <div className="mt-6 h-5 w-24 rounded bg-rose/10" />
        </div>
      </div>
    </li>
  );
}

// ── The form: a blank page from the same pad ────────────────────────────────

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
          speed: 500,
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
      setServerError("Your wish didn't send. Check your connection and try again.");
      setStatus("error");
    }
  }

  const count = message.length;
  const isPublic = visibility === "public";

  return (
    <form onSubmit={handleSubmit} onFocusCapture={markStarted} noValidate className="space-y-5 text-left">
      <div className="wish-shadow">
        <div className="wish-paper torn-paper-top">
          <label htmlFor="wish-message" className="sr-only">
            Your wish
          </label>
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
            className="wish-lines-text block w-full resize-none border-0 bg-transparent p-0 font-hand text-ink placeholder:text-ink/35 focus:outline-none focus:ring-0"
          />
          <p className="font-hand text-[1.45rem] leading-[2rem] text-ink/60">With love,</p>
          <label htmlFor="wish-name" className="sr-only">
            Your name
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
            className="block w-full border-0 border-b border-dashed border-rose/35 bg-transparent px-0 pt-0 pb-1 font-script text-[2.1rem] leading-[2.4rem] text-rose-deep placeholder:text-rose/40 focus:border-rose focus:outline-none focus:ring-0"
          />
          <span
            id="wish-count"
            className={`pointer-events-none absolute top-5 right-5 font-body text-[10px] tabular-nums ${
              count > MESSAGE_MAX - 40 ? "text-rose-deep" : "text-ink/30"
            }`}
          >
            {count}/{MESSAGE_MAX}
          </span>
        </div>
      </div>
      {(errors.message || errors.name) && (
        <div className="-mt-1 space-y-1">
          {errors.message && (
            <p id="wish-message-error" role="alert" className="font-body text-xs text-rose-deep">
              {errors.message}
            </p>
          )}
          {errors.name && (
            <p id="wish-name-error" role="alert" className="font-body text-xs text-rose-deep">
              {errors.name}
            </p>
          )}
        </div>
      )}

      <fieldset>
        <legend className="font-body text-sm font-bold text-ink">Who can read it?</legend>
        <div role="radiogroup" aria-label="Who can read your wish" className="relative mt-2 grid grid-cols-2 rounded-full border border-ink/10 bg-white/70 p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-rose shadow-sm transition-transform duration-300 ease-out"
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
              className={`relative flex items-center justify-center gap-1.5 rounded-full py-2.5 font-body text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 ${
                visibility === value ? "text-white" : "text-ink/55"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <p
          key={visibility}
          className={`wish-note mt-2.5 flex gap-2 rounded-2xl border bg-white/65 px-3.5 py-2.5 font-body text-xs leading-relaxed text-ink/70 ${
            isPublic ? "border-rose/20" : "border-dusk/30"
          }`}
        >
          {isPublic ? (
            <GlobeIcon className="mt-px h-4 w-4 flex-shrink-0 text-rose" />
          ) : (
            <LockIcon className="mt-px h-4 w-4 flex-shrink-0 text-dusk-deep" />
          )}
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

      <div aria-live="polite">
        {status === "sent" && (
          <p className="wish-note text-center font-hand text-2xl text-rose-deep">
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
          className="mt-10"
        >
          <WishForm onPosted={handlePosted} />
        </motion.div>

        {!!total && (
          <p className="mt-12 flex items-center justify-center gap-2 font-hand text-2xl text-ink/70">
            <HeartIcon className="h-4 w-4 text-rose" />
            {total} {total === 1 ? "wish" : "wishes"} and counting
            <HeartIcon className="h-4 w-4 text-dusk" />
          </p>
        )}

        <div className="mt-8">
          {state === "error" && wishes.length === 0 ? (
            <div className="text-center">
              <p className="font-body text-sm text-ink/60">The wishes didn&apos;t load.</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-3 rounded-full border-2 border-rose/30 bg-white/70 px-5 py-2 font-body text-xs font-bold text-rose-deep"
              >
                Try again
              </button>
            </div>
          ) : state === "ready" && wishes.length === 0 ? (
            <div className="wish-shadow">
              <div className="wish-paper torn-paper-top text-center">
                <p className="wish-lines-text font-hand text-ink/50">{wedding.wishes.empty}</p>
              </div>
            </div>
          ) : (
            <ul aria-label="Wishes from friends and family" aria-busy={state !== "ready"} className="space-y-7">
              {wishes.length === 0
                ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
                : wishes.map((wish, i) => (
                    <WishCard key={wish.id} wish={wish} now={now} order={i % 8} fresh={freshIds.has(wish.id)} />
                  ))}
            </ul>
          )}

          {cursor && wishes.length > 0 && (
            <div className="mt-9 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full border-2 border-rose/30 bg-white/70 px-6 py-3 font-body text-sm font-bold text-rose-deep shadow-sm transition hover:bg-white active:scale-[0.98] disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : `Show more wishes${remaining ? ` (${remaining} more)` : ""}`}
              </button>
              {moreError && (
                <p role="alert" className="mt-2 font-body text-xs text-rose-deep">
                  More wishes didn&apos;t load. Tap to try again.
                </p>
              )}
            </div>
          )}
          {!cursor && state === "ready" && wishes.length > 0 && (
            <p className="mt-9 text-center font-hand text-xl text-ink/55">{wedding.wishes.end}</p>
          )}
        </div>
      </div>
    </section>
  );
}
