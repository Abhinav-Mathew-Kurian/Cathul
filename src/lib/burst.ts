// One-shot celebratory bursts — the wax seal cracking open, an RSVP landing,
// a lantern, a double-tap. One shared full-screen canvas is created on
// demand and removed again the moment the last particle dies, so it costs
// nothing while idle and never sits over the page catching taps.
//
// Where the browser allows it, the canvas is handed to a Web Worker
// (burst.worker.ts) that runs the physics and drawing off the main thread —
// the seal's burst lands exactly while React, the gatefold and the hero are
// all busy, and used to be the single biggest piece of main-thread work in
// that moment. Anywhere that isn't supported (or until the worker has said
// it works), the very same engine runs on the main thread instead.

import { CONFETTI_COLORS, PETAL_COLORS, spawn, step, type BurstOptions, type Particle } from "./burst-engine";

export { CONFETTI_COLORS, PETAL_COLORS, type BurstOptions };

let canvas: HTMLCanvasElement | null = null;

// ── Worker mode ──────────────────────────────────────────────────────────
// Protocol: the page sends "session" (the transferred canvas) then "burst"
// messages numbered by `sent`. When the worker runs out of particles it
// replies "idle" with the last number it handled; only if that's still the
// latest does the page send "end" and remove the canvas — otherwise a newer
// burst is already on its way and the session carries on.

let worker: Worker | null = null;
let workerReady = false;
let sent = 0;
// This session's bursts, kept so they can be replayed on the main thread if
// the worker fails partway — a burst is never silently lost.
let inFlight: BurstOptions[] = [];

function startWorker() {
  if (worker || typeof window === "undefined") return;
  if (typeof Worker === "undefined" || !("transferControlToOffscreen" in HTMLCanvasElement.prototype)) return;
  try {
    worker = new Worker(new URL("./burst.worker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
    return;
  }
  worker.onmessage = ({ data }) => {
    if (data.type === "ready") {
      workerReady = data.supported;
      if (!workerReady) stopWorker();
    } else if (data.type === "idle" && data.seq === sent && canvas) {
      worker?.postMessage({ type: "end" });
      inFlight = [];
      removeCanvas();
    } else if (data.type === "failed") {
      fallBack();
    }
  };
  worker.onerror = fallBack;
}

// The worker can't be used after all: switch to the main thread for good and
// replay whatever this session had sent it.
function fallBack() {
  const replay = offscreen ? inFlight : [];
  inFlight = [];
  stopWorker();
  removeCanvas();
  for (const options of replay) burst(options);
}

function stopWorker() {
  worker?.terminate();
  worker = null;
  workerReady = false;
}

// Spun up as soon as this module loads, so it's ready long before anyone
// taps the seal.
startWorker();

// ── Shared canvas ────────────────────────────────────────────────────────

let offscreen = false;

function size() {
  return { width: window.innerWidth, height: window.innerHeight, dpr: Math.min(window.devicePixelRatio || 1, 2) };
}

function onResize() {
  const { width, height, dpr } = size();
  if (offscreen) {
    worker?.postMessage({ type: "resize", width, height, dpr });
  } else if (canvas && ctx) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function createCanvas() {
  const el = document.createElement("canvas");
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "70",
  });
  document.body.appendChild(el);
  window.addEventListener("resize", onResize);
  return el;
}

function removeCanvas() {
  window.removeEventListener("resize", onResize);
  canvas?.remove();
  canvas = null;
  offscreen = false;
  ctx = null;
  particles = [];
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

// ── Main-thread fallback ─────────────────────────────────────────────────

let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;
let lastFrame = 0;

function frame(now: number) {
  if (!ctx) return;
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  particles = step(ctx, particles, dt, window.innerWidth, window.innerHeight);
  if (particles.length === 0) {
    raf = 0;
    removeCanvas();
    return;
  }
  raf = requestAnimationFrame(frame);
}

// ── API ──────────────────────────────────────────────────────────────────

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function burst(options: BurstOptions) {
  if (typeof window === "undefined" || prefersReducedMotion()) return;

  if (!canvas && worker && workerReady) {
    try {
      canvas = createCanvas();
      const transferred = canvas.transferControlToOffscreen();
      worker.postMessage({ type: "session", canvas: transferred, ...size() }, [transferred]);
      offscreen = true;
    } catch {
      stopWorker();
      removeCanvas();
    }
  }

  if (canvas && offscreen) {
    inFlight.push(options);
    worker?.postMessage({ type: "burst", options, seq: ++sent });
    return;
  }

  if (!canvas) {
    canvas = createCanvas();
    ctx = canvas.getContext("2d");
    onResize();
  }
  spawn(particles, options);
  if (!raf) {
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

/** A short buzz on phones that support it (Android); silently a no-op elsewhere. */
export function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers throw when vibration is blocked by policy — never fatal.
  }
}
