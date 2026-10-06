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
  send({ id: visitId, event });
}
