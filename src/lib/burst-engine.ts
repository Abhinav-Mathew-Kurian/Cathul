// The particle physics and drawing behind burst() — shared by the Web Worker
// (burst.worker.ts, which renders off the main thread) and the main-thread
// fallback in burst.ts, so both look identical.

export type Shape = "petal" | "heart" | "confetti";

export type Particle = {
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

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function drawShape(c: Context2D, shape: Shape, s: number) {
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

export function spawn(
  particles: Particle[],
  {
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
  }: BurstOptions
) {
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
}

/** Advances and draws one frame; returns the particles still alive. */
export function step(ctx: Context2D, particles: Particle[], dt: number, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  const alive = particles.filter((p) => p.age < p.life && p.y < height + 60);

  for (const p of alive) {
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

  return alive;
}
