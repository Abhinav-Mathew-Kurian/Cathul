// A tiny canvas particle engine for one-shot celebratory bursts — the wax
// seal cracking open, an RSVP landing. One shared full-screen canvas is
// created on demand and removed again the moment the last particle dies, so
// it costs nothing while idle and never sits over the page catching taps.

type Shape = "petal" | "heart" | "confetti";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  size: number;
  color: string;
  shape: Shape;
  age: number;
  life: number;
  wobblePhase: number;
  wobbleSpeed: number;
  flipSpeed: number;
};

export type BurstOptions = {
  /** Viewport coordinates (clientX/clientY space) the burst fires from. */
  x: number;
  y: number;
  count?: number;
  /** Direction in degrees — -90 is straight up, 0 is right. */
  angle?: number;
  /** Total cone width in degrees; 360 fires in every direction. */
  spread?: number;
  /** Launch speed in px/s (each particle gets a random share of it). */
  speed?: number;
  shapes?: Shape[];
  colors?: string[];
  /** Particle size range in px. */
  size?: [number, number];
  /** Average lifetime in seconds. */
  life?: number;
};

// Light shapes (petals, hearts) hit a slow terminal velocity and float;
// paper confetti is heavier and falls faster — terminal speed = gravity / drag.
const PHYSICS: Record<Shape, { gravity: number; drag: number }> = {
  petal: { gravity: 420, drag: 2.8 },
  heart: { gravity: 360, drag: 2.6 },
  confetti: { gravity: 720, drag: 2.2 },
};

export const PETAL_COLORS = ["#c1594a", "#e6a99b", "#f6d9ce", "#fdfbf3", "#8ca4c4"];
export const CONFETTI_COLORS = ["#c1594a", "#ffcf7a", "#8ca4c4", "#5f7a52", "#f6d9ce", "#fdfbf3"];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;
let lastFrame = 0;

function resize() {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "70",
  });
  ctx = canvas.getContext("2d");
  document.body.appendChild(canvas);
  resize();
  window.addEventListener("resize", resize);
}

function teardown() {
  window.removeEventListener("resize", resize);
  canvas?.remove();
  canvas = null;
  ctx = null;
  raf = 0;
}

function drawShape(c: CanvasRenderingContext2D, shape: Shape, s: number) {
  c.beginPath();
  if (shape === "confetti") {
    c.rect(-s / 2, -s / 4, s, s / 2);
  } else if (shape === "petal") {
    // Teardrop — narrow at the stem, round at the tip.
    c.moveTo(0, -s / 2);
    c.bezierCurveTo(s * 0.55, -s * 0.2, s * 0.35, s * 0.5, 0, s / 2);
    c.bezierCurveTo(-s * 0.35, s * 0.5, -s * 0.55, -s * 0.2, 0, -s / 2);
  } else {
    const h = s / 2;
    c.moveTo(0, h * 0.9);
    c.bezierCurveTo(-h * 1.3, 0, -h * 0.7, -h * 1.1, 0, -h * 0.35);
    c.bezierCurveTo(h * 0.7, -h * 1.1, h * 1.3, 0, 0, h * 0.9);
  }
  c.fill();
}

function step(now: number) {
  if (!ctx) return;
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.clearRect(0, 0, width, height);

  particles = particles.filter((p) => p.age < p.life && p.y < height + 60);

  for (const p of particles) {
    const { gravity, drag } = PHYSICS[p.shape];
    p.age += dt;
    p.vx -= p.vx * drag * dt;
    p.vy += (gravity - p.vy * drag) * dt;
    // Side-to-side flutter, strongest once the launch speed has bled off.
    p.x += p.vx * dt + Math.sin(p.age * p.wobbleSpeed + p.wobblePhase) * 38 * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;

    const fadeIn = Math.min(1, p.age / 0.06);
    const fadeOut = Math.min(1, (p.life - p.age) / 0.6);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    // Squashing one axis on a cosine fakes the piece tumbling in 3D.
    ctx.scale(1, p.shape === "heart" ? 1 : Math.cos(p.age * p.flipSpeed));
    drawShape(ctx, p.shape, p.size);
    ctx.restore();
  }

  if (particles.length === 0) {
    teardown();
    return;
  }
  raf = requestAnimationFrame(step);
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function burst({
  x,
  y,
  count = 60,
  angle = -90,
  spread = 360,
  speed = 700,
  shapes = ["petal"],
  colors = PETAL_COLORS,
  size = [7, 13],
  life = 3.2,
}: BurstOptions) {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  ensureCanvas();

  for (let i = 0; i < count; i++) {
    const direction = ((angle + (Math.random() - 0.5) * spread) * Math.PI) / 180;
    const launch = speed * (0.35 + Math.random() * 0.75);
    particles.push({
      x,
      y,
      vx: Math.cos(direction) * launch,
      vy: Math.sin(direction) * launch,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 9,
      size: size[0] + Math.random() * (size[1] - size[0]),
      color: colors[i % colors.length],
      shape: shapes[i % shapes.length],
      age: 0,
      life: life * (0.7 + Math.random() * 0.6),
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 2.5 + Math.random() * 4,
      flipSpeed: 3 + Math.random() * 7,
    });
  }

  if (!raf) {
    lastFrame = performance.now();
    raf = requestAnimationFrame(step);
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
