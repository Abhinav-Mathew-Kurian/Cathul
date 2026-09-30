// Runs burst() physics and drawing off the main thread, on an OffscreenCanvas
// handed over by burst.ts. Frames go straight to the compositor, so petals
// keep flying smoothly even while the page itself is busy (the invitation
// opening is exactly such a moment). Protocol: see burst.ts.

import { spawn, step, type BurstOptions, type Particle } from "./burst-engine";

type Message =
  | { type: "session"; canvas: OffscreenCanvas; width: number; height: number; dpr: number }
  | { type: "burst"; options: BurstOptions; seq: number }
  | { type: "resize"; width: number; height: number; dpr: number }
  | { type: "end" };

const scope = self as unknown as {
  postMessage: (message: unknown) => void;
  onmessage: ((event: MessageEvent<Message>) => void) | null;
  requestAnimationFrame?: (cb: (time: number) => void) => number;
};

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let width = 0;
let height = 0;
let running = false;
let lastFrame = 0;
let seq = 0;

// Workers in some browsers have no requestAnimationFrame; a ~60Hz timer is a
// fine stand-in there.
const nextFrame = (cb: (time: number) => void) =>
  scope.requestAnimationFrame ? scope.requestAnimationFrame(cb) : setTimeout(() => cb(performance.now()), 16);

function resize(w: number, h: number, dpr: number) {
  width = w;
  height = h;
  if (!canvas || !ctx) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame(now: number) {
  if (!ctx) {
    running = false;
    return;
  }
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  particles = step(ctx, particles, dt, width, height);
  if (particles.length === 0) {
    running = false;
    // Keep the canvas until the page confirms no newer burst is in flight.
    scope.postMessage({ type: "idle", seq });
    return;
  }
  nextFrame(frame);
}

scope.onmessage = ({ data }) => {
  if (data.type === "session") {
    canvas = data.canvas;
    ctx = canvas.getContext("2d");
    if (!ctx) {
      scope.postMessage({ type: "failed" });
      return;
    }
    resize(data.width, data.height, data.dpr);
  } else if (data.type === "burst") {
    seq = data.seq;
    spawn(particles, data.options);
    if (!running && ctx) {
      running = true;
      lastFrame = performance.now();
      nextFrame(frame);
    }
  } else if (data.type === "resize") {
    resize(data.width, data.height, data.dpr);
  } else if (data.type === "end") {
    canvas = null;
    ctx = null;
    particles = [];
  }
};

// Report whether this browser can draw 2D on an OffscreenCanvas in a worker.
let supported = false;
try {
  supported = !!new OffscreenCanvas(1, 1).getContext("2d");
} catch {
  supported = false;
}
scope.postMessage({ type: "ready", supported });
