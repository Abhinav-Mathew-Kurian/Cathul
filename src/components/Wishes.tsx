"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { wedding } from "@/content/wedding";
import { burst, haptic, prefersReducedMotion } from "@/lib/burst";
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

// Each wish is released as a lantern into a dusk sky — the same paper
// lanterns that float over the footer. The newest nine drift in the sky
// (tap one to read it); every wish is also in the list below, newest first.

const VIEWPORT = { once: true, margin: "-60px" } as const;
const GOLD = ["#ffcf7a", "#ffe3a3", "#f29a4a", "#fff4c9"];
const SKY_MAX = 9;

// Where the lanterns hang in the sky: [left %, top %, scale]. The newest wish
// takes the first, most prominent spot; older ones glide down the list.
const SKY_SLOTS: [number, number, number][] = [
  [50, 30, 1.75],
  [19, 22, 1.2],
  [81, 20, 1.3],
  [31, 52, 1.35],
  [70, 50, 1.45],
  [13, 72, 1.05],
  [88, 70, 1.1],
  [50, 76, 1.15],
  [30, 88, 0.9],
];

const STARS = [
  [8, 9, 0],
  [24, 5, 1.1],
  [41, 12, 2.3],
  [63, 6, 0.6],
  [76, 11, 1.8],
  [92, 7, 2.9],
  [56, 17, 1.4],
];

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

// Just the first name under a lantern (the full one shows when it opens).
const firstName = (name: string) => name.trim().split(/\s+/)[0].slice(0, 14);

/** The footer's paper lantern, at any size. */
function Lantern({ scale = 1, className = "" }: { scale?: number; className?: string }) {
  return (
    <span
      className={`relative flex h-12 w-10 items-center justify-center ${className}`}
      style={{ transform: `scale(${scale})` }}
    >
      <span className="lantern-halo" />
      <span className="lantern-body" />
    </span>
  );
}

// ── The sky ─────────────────────────────────────────────────────────────────

function SkyLantern({
  wish,
  slot,
  releasing,
  onOpen,
}: {
  wish: PublicWish;
  slot: number;
  releasing: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [left, top, scale] = SKY_SLOTS[slot];
  const h = hash(wish.id);

  // The guest's own wish rises from the horizon to its spot, then flares.
  useEffect(() => {
    const el = ref.current;
    const sky = el?.parentElement;
    if (!releasing || !el || !sky || prefersReducedMotion()) return;
    const rise = sky.clientHeight - el.offsetTop + 40;
    const flight = el.animate(
      [
        { transform: `translate(-50%, calc(-50% + ${rise}px)) scale(0.55)`, opacity: 0 },
        { transform: `translate(calc(-50% - 16px), calc(-50% + ${rise * 0.55}px)) scale(0.8)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + 12px), calc(-50% + ${rise * 0.18}px)) scale(0.95)`, offset: 0.7 },
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      ],
      { duration: 2400, delay: 450, easing: "cubic-bezier(0.3, 0.1, 0.3, 1)", fill: "backwards" }
    );
    flight.finished
      .then(() => {
        el.querySelector(".lantern-halo")?.animate(
          [
            { transform: "scale(1)", opacity: 0.7 },
            { transform: "scale(2.6)", opacity: 1 },
            { transform: "scale(1)", opacity: 0.7 },
          ],
          { duration: 1100, easing: "ease-out" }
        );
        const box = el.getBoundingClientRect();
        burst({
          x: box.left + box.width / 2,
          y: box.top + box.height / 3,
          count: 22,
          speed: 320,
          shapes: ["heart", "petal"],
          colors: GOLD,
          size: [5, 10],
          life: 1.8,
        });
      })
      .catch(() => {});
    return () => flight.cancel();
  }, [releasing]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-label={`Read ${wish.name}'s wish`}
      className="sky-lantern rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <span
        className="sky-bob"
        style={{ animationDuration: `${5 + (h % 30) / 10}s`, animationDelay: `-${(h >>> 5) % 50 / 10}s` } as CSSProperties}
      >
        <Lantern scale={scale} />
        <span className="sky-name font-hand text-base leading-none text-white" style={{ marginTop: 6 + (scale - 1) * 18 }}>
          {firstName(wish.name)}
        </span>
      </span>
    </button>
  );
}

function Sky({
  wishes,
  state,
  releasingId,
  onOpen,
  skyRef,
}: {
  wishes: PublicWish[];
  state: "idle" | "loading" | "ready" | "error";
  releasingId: string | null;
  onOpen: (index: number) => void;
  skyRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={skyRef} className="wish-sky">
      {STARS.map(([x, y, delay], i) => (
        <span key={i} aria-hidden className="sky-star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }} />
      ))}
      {wishes.length > 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-3.5 text-center font-hand text-lg text-white/85">
          {wedding.wishes.skyHint}
        </p>
      )}
      {wishes.map((wish, i) => (
        <SkyLantern
          key={wish.id}
          wish={wish}
          slot={i}
          releasing={wish.id === releasingId}
          onOpen={() => onOpen(i)}
        />
      ))}
      {state === "ready" && wishes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <Lantern scale={1.5} className="opacity-60" />
          <p className="font-hand text-2xl leading-snug text-white">{wedding.wishes.empty}</p>
        </div>
      )}
      {state === "loading" && wishes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Lantern scale={1.4} className="animate-pulse opacity-70" />
        </div>
      )}
    </div>
  );
}

// ── Reading a lantern ───────────────────────────────────────────────────────

const subscribeNothing = () => () => {};

function Reader({
  wishes,
  index,
  now,
  onClose,
  onMove,
}: {
  wishes: PublicWish[];
  index: number | null;
  now: number;
  onClose: () => void;
  onMove: (index: number) => void;
}) {
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wish = index === null ? null : wishes[index];

  useEffect(() => {
    if (index === null) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < wishes.length - 1) onMove(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onMove(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, wishes.length, onClose, onMove]);

  if (!isClient) return null;
  // Portalled: sections use content-visibility, whose containment would trap
  // a fixed overlay inside the section (same as the gallery lightbox).
  return createPortal(
    <AnimatePresence>
      {wish && index !== null && (
        <motion.div
          key="reader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f3a5c]/60 px-6"
        >
          <motion.div
            key={wish.id}
            role="dialog"
            aria-modal="true"
            aria-label={`${wish.name}'s wish`}
            initial={{ opacity: 0, transform: "translateY(24px) scale(0.92)" }}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-[2rem] bg-cream px-7 pt-16 pb-6 text-center shadow-2xl"
          >
            <span className="absolute -top-9 left-1/2 -translate-x-1/2">
              <Lantern scale={2.1} />
            </span>
            <p className="whitespace-pre-line font-hand text-[1.6rem] leading-snug text-ink/85 [overflow-wrap:anywhere]">
              {wish.message}
            </p>
            <p className="mt-4 font-script text-4xl leading-none text-rose-deep">{wish.name}</p>
            <p className="mt-2 font-body text-[11px] text-ink/40">{when(wish.createdAt, now)}</p>

            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onMove(index - 1)}
                disabled={index === 0}
                aria-label="Previous wish"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl text-rose-deep shadow-sm disabled:opacity-30"
              >
                ‹
              </button>
              <span className="font-body text-xs text-ink/40">
                {index + 1} / {wishes.length}
              </span>
              <button
                type="button"
                onClick={() => onMove(index + 1)}
                disabled={index === wishes.length - 1}
                aria-label="Next wish"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl text-rose-deep shadow-sm disabled:opacity-30"
              >
                ›
              </button>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-rose text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ×
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ── The list ────────────────────────────────────────────────────────────────

function WishRow({ wish, now, order, onOpen }: { wish: PublicWish; now: number; order: number; onOpen?: () => void }) {
  return (
    <li className="wish-in" style={{ animationDelay: `${Math.min(order, 7) * 60}ms` }}>
      <div className="flex gap-3 rounded-3xl border border-ink/10 bg-white/70 p-4 shadow-[var(--card-shadow)]">
        <button
          type="button"
          onClick={onOpen}
          tabIndex={onOpen ? 0 : -1}
          aria-hidden={!onOpen}
          aria-label={onOpen ? `Find ${wish.name}'s lantern in the sky` : undefined}
          className="-mt-1 flex-shrink-0"
        >
          <Lantern scale={0.85} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-line font-hand text-[1.3rem] leading-snug text-ink/85 [overflow-wrap:anywhere]">
            {wish.message}
          </p>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <span className="min-w-0 truncate font-script text-[1.7rem] leading-none text-rose-deep">{wish.name}</span>
            <time dateTime={wish.createdAt} className="flex-shrink-0 font-body text-[11px] text-ink/40">
              {when(wish.createdAt, now)}
            </time>
          </div>
        </div>
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
  const [privateLanterns, setPrivateLanterns] = useState<number[]>([]);
  const startedAt = useRef<number | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

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
      else setPrivateLanterns((l) => [...l, Date.now()]);
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
  const field =
    "mt-1.5 w-full rounded-xl border bg-white/85 px-3.5 py-3 text-ink placeholder:text-ink/35 focus:border-rose focus:outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      onFocusCapture={markStarted}
      noValidate
      className="space-y-5 rounded-3xl border border-ink/10 bg-white/70 p-5 text-left shadow-[var(--card-shadow)]"
    >
      <div>
        <label htmlFor="wish-message" className="font-body text-sm font-bold text-ink">
          Your wish <span className="text-rose">*</span>
        </label>
        <div className="relative">
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
            className={`${field} resize-none pb-6 font-hand text-xl leading-7 ${errors.message ? "border-rose-deep" : "border-ink/15"}`}
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

      <div>
        <label htmlFor="wish-name" className="font-body text-sm font-bold text-ink">
          Your name <span className="text-rose">*</span>
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
          className={`${field} font-body text-sm ${errors.name ? "border-rose-deep" : "border-ink/15"}`}
        />
        {errors.name && (
          <p id="wish-name-error" role="alert" className="mt-1 font-body text-xs text-rose-deep">
            {errors.name}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="font-body text-sm font-bold text-ink">Who can read it?</legend>
        <div role="radiogroup" aria-label="Who can read your wish" className="relative mt-2 grid grid-cols-2 rounded-full border border-ink/10 bg-white/80 p-1">
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

      <div className="relative">
        {privateLanterns.map((id) => (
          <span
            key={id}
            aria-hidden
            className="private-lantern"
            onAnimationEnd={() => setPrivateLanterns((l) => l.filter((x) => x !== id))}
          >
            <Lantern />
          </span>
        ))}
        <button
          type="submit"
          disabled={status === "sending"}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-rose py-4 font-body text-sm font-bold text-white shadow-[var(--card-shadow)] transition hover:bg-rose-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "sending" ? "Lighting your lantern..." : isPublic ? "Release your lantern" : "Send privately"}
          {status !== "sending" && <HeartIcon className="h-4 w-4" />}
        </button>
      </div>

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
  // "loading" from the start: the first page is requested on mount.
  const [state, setState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [reading, setReading] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const sectionRef = useRef<HTMLElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
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
  const refresh = useCallback(() => {
    lastRefresh.current = Date.now();
    return fetchPage(null).then(
      (page) => {
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
      },
      () => setState((s) => (s === "ready" ? s : "error"))
    );
  }, []);

  // The first page loads straight away — while the guest is still at the
  // invitation gate — so the sky is already full however they get here,
  // scrolling or jumping straight to #wishes. After that, coming back near
  // the wall a minute later picks up anything new.
  useEffect(() => {
    refresh();
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
    setReleasingId(wish.id);
    setNow(Date.now());
    setState("ready");
    // Bring the sky into view so the guest watches their lantern go up.
    skyRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  }

  const skyWishes = wishes.slice(0, SKY_MAX);
  const closeReader = useCallback(() => setReading(null), []);
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
          transition={{ duration: 0.7, delay: 0.1 }}
          className="-mx-2 mt-8"
        >
          {state === "error" && wishes.length === 0 ? (
            <div className="wish-sky flex flex-col items-center justify-center gap-3 px-8 text-center">
              <p className="font-hand text-2xl text-white">The lanterns didn&apos;t load.</p>
              <button
                type="button"
                onClick={() => {
                  setState("loading");
                  refresh();
                }}
                className="rounded-full bg-white/85 px-5 py-2 font-body text-xs font-bold text-rose-deep"
              >
                Try again
              </button>
            </div>
          ) : (
            <Sky wishes={skyWishes} state={state} releasingId={releasingId} onOpen={setReading} skyRef={skyRef} />
          )}
        </motion.div>

        <div className="mt-8">
          <WishForm onPosted={handlePosted} />
        </div>

        {wishes.length > 0 && (
          <>
            <p className="mt-12 flex items-center justify-center gap-2 font-hand text-2xl text-ink/70">
              <HeartIcon className="h-4 w-4 text-rose" />
              {total ?? wishes.length} {(total ?? wishes.length) === 1 ? "wish" : "wishes"} and counting
              <HeartIcon className="h-4 w-4 text-dusk" />
            </p>
            <ul aria-label="Wishes from friends and family" className="mt-6 space-y-4">
              {wishes.map((wish, i) => (
                <WishRow
                  key={wish.id}
                  wish={wish}
                  now={now}
                  order={i % 8}
                  onOpen={i < SKY_MAX ? () => setReading(i) : undefined}
                />
              ))}
            </ul>
          </>
        )}

        {cursor && wishes.length > 0 && (
          <div className="mt-8 text-center">
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
          <p className="mt-8 text-center font-hand text-xl text-ink/55">{wedding.wishes.end}</p>
        )}
      </div>

      <Reader wishes={skyWishes} index={reading} now={now} onClose={closeReader} onMove={setReading} />
    </section>
  );
}
