import type { VisitEvent } from "./visits-store";

// The browser half of visit counting. Fire-and-forget beacons: they never
// block the page, survive the tab closing, and fail silently.
//
// On the analytics page the couple can switch counting off for their own
// devices, so their checking-in doesn't inflate the numbers.

export const DONT_COUNT_KEY = "cathul:dont-count";
const VISITOR_KEY = "cathul:visitor";

let visitId: string | null = null;
const sent = new Set<string>();

// ── Time spent ─────────────────────────────────────────────────────────────
// Only time the page is on screen *and* in use counts. Time in another app or
// tab is skipped (the clock pauses while the page is hidden), and so is a
// page left open untouched: each gap between a guest's touches, scrolls or
// key presses counts for at most IDLE_MS. Reading a section, or a song playing
// while they read, fits well inside that; a phone face-down on the table or a
// desktop tab left behind another window doesn't.
const IDLE_MS = 90_000;
let activeMs = 0;
let lastActive = 0;
let counting = false;

function tick() {
  const now = performance.now();
  if (counting) activeMs += Math.min(now - lastActive, IDLE_MS);
  lastActive = now;
}

const activeSeconds = () => {
  tick();
  return Math.round(activeMs / 1000);
};

/** Starts the clock; returns a cleanup. Called once by VisitTracker. */
export function watchActiveTime() {
  counting = document.visibilityState === "visible";
  lastActive = performance.now();
  const onActivity = () => document.visibilityState === "visible" && tick();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      // The guest is leaving or switching away: close the stretch and report it.
      tick();
      counting = false;
      track("ping");
    } else {
      counting = true;
      lastActive = performance.now();
    }
  };
  const events = ["pointerdown", "keydown", "scroll", "wheel", "touchstart"] as const;
  for (const e of events) window.addEventListener(e, onActivity, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    for (const e of events) window.removeEventListener(e, onActivity);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

function send(payload: object) {
  const body = JSON.stringify(payload);
  if (!navigator.sendBeacon?.("/api/visit", body)) {
    fetch("/api/visit", { method: "POST", body, keepalive: true }).catch(() => {});
  }
}

/** Starts this page load's visit. Safe to call twice (Strict Mode). */
export function startTracking() {
  if (visitId) return;
  let known: string | null = null;
  let visitor: string;
  try {
    if (localStorage.getItem(DONT_COUNT_KEY) === "1") return;
    known = localStorage.getItem(VISITOR_KEY);
    visitor = known ?? crypto.randomUUID();
    if (!known) localStorage.setItem(VISITOR_KEY, visitor);
    visitId = crypto.randomUUID();
  } catch {
    // Storage blocked (private mode) or no crypto.randomUUID (plain http):
    // count the visit anyway as a one-time visitor, if we can make an id.
    if (typeof crypto?.randomUUID !== "function") return;
    visitor = crypto.randomUUID();
    visitId = crypto.randomUUID();
  }
  const params = new URLSearchParams(location.search);
  send({
    id: visitId,
    event: "start",
    visitor,
    returning: !!known,
    referrer: document.referrer,
    src: params.get("src") ?? params.get("utm_source") ?? "",
  });
}

/** Records something this visit did. One-off events are only sent once. */
export function track(event: VisitEvent) {
  if (!visitId) return;
  if (event !== "ping") {
    if (sent.has(event)) return;
    sent.add(event);
  }
  // Every event carries the running total, so a lost "leaving" beacon (some
  // in-app browsers close without one) only loses the last stretch.
  send({ id: visitId, event, active: activeSeconds() });
}
