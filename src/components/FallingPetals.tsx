"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useMotionValueEvent } from "motion/react";
import { useMusicPulse } from "./MusicProvider";

// Deterministic pseudo-randomness (no Math.random) so this stays a pure
// render — each petal's trajectory comes from its own index instead.
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const PETAL_COLORS = ["var(--rose)", "#e6a99b", "#f6d9ce", "var(--dusk)"];

// Music drives petal speed in a few coarse steps (with hysteresis) rather
// than continuously — every playback-rate change re-syncs each animation
// with the compositor, so doing it per frame made scrolling stutter.
const RATE_STEPS = [1, 1.4, 1.9];
const STEP_UP = [0.32, 0.58];
const HYSTERESIS = 0.06;

type Petal = {
  id: number;
  style: CSSProperties;
  keyframes: Keyframe[];
  duration: number;
  phase: number;
};

type FallingPetalsProps = {
  /** How many petals to render — lower this in denser/text-heavy sections. */
  count?: number;
  /** Shifts every petal's seed so two instances on the same page never share a trajectory. */
  seedOffset?: number;
  /** Positioning + stacking for the wrapper — callers control where petals sit in their own layer stack. */
  className?: string;
};

// A path sampled at the old CSS keyframe stops: [offset, x-drift share, y (vh), rotate share].
const PATH: [number, number, number, number][] = [
  [0, 0, -10, 0],
  [0.35, 0.6, 35, 0.4],
  [0.65, -0.7, 70, 0.75],
  [1, 0.3, 112, 1],
];

function buildKeyframes(seed: number): Omit<Petal, "id" | "style"> {
  const spin = seeded(seed, 7) > 0.5 ? 1 : -1;
  const drift = spin * (16 + seeded(seed, 5) * 48);
  const rotate = spin * (150 + seeded(seed, 6) * 380);
  const scales = [0.5 + seeded(seed, 8) * 0.25, 0.85 + seeded(seed, 9) * 0.35, 0.65 + seeded(seed, 10) * 0.3];
  const peak = 0.5 + seeded(seed, 11) * 0.4;
  const scaleAt = [scales[0], scales[1], scales[2], scales[2]];

  // Every keyframe carries concrete values for both properties (no CSS
  // variables), which is what lets the browser run them on the compositor.
  const at = (offset: number) => {
    let i = 0;
    while (i < PATH.length - 2 && offset > PATH[i + 1][0]) i++;
    const [o0, x0, y0, r0] = PATH[i];
    const [o1, x1, y1, r1] = PATH[i + 1];
    const t = (offset - o0) / (o1 - o0);
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const transform = `translate3d(${(lerp(x0, x1) * drift).toFixed(1)}px, ${lerp(y0, y1).toFixed(1)}vh, 0) rotate(${(
      lerp(r0, r1) * rotate
    ).toFixed(0)}deg) scale(${lerp(scaleAt[i], scaleAt[i + 1]).toFixed(2)})`;
    const opacity = offset === 0 || offset === 1 ? 0 : peak;
    return { offset, transform, opacity };
  };

  return {
    keyframes: [0, 0.12, 0.35, 0.65, 0.88, 1].map(at),
    duration: (10 + seeded(seed, 3) * 10) * 1000,
    phase: seeded(seed, 4),
  };
}

export function FallingPetals({
  count = 18,
  seedOffset = 0,
  className = "absolute inset-0 z-0",
}: FallingPetalsProps) {
  const petals = useMemo<Petal[]>(() => {
    return Array.from({ length: count }).map((_, i) => {
      const seed = i + seedOffset;
      return {
        id: seed,
        style: {
          left: `${Math.round(seeded(seed, 1) * 100)}%`,
          width: `${(6 + seeded(seed, 2) * 10).toFixed(1)}px`,
          height: `${(6 + seeded(seed, 2) * 10).toFixed(1)}px`,
          background: PETAL_COLORS[i % PETAL_COLORS.length],
          borderRadius: i % 3 === 0 ? "50% 50% 50% 10%" : "70% 30% 65% 35%",
        },
        ...buildKeyframes(seed),
      };
    });
  }, [count, seedOffset]);

  const containerRef = useRef<HTMLDivElement>(null);
  const animationsRef = useRef<Animation[]>([]);
  const stepRef = useRef(0);

  // Petals only animate while their section is on (or near) screen — the
  // page has ~75 of them across its sections, and animating every one of
  // them offscreen was the single biggest cost while scrolling.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof container.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const start = () => {
      if (animationsRef.current.length) return;
      const now = performance.now();
      const elements = Array.from(container.children) as HTMLElement[];
      animationsRef.current = elements.map((el, i) => {
        const petal = petals[i];
        // Start mid-flight, at a phase that keeps moving with the clock, so
        // coming back to a section never replays the same petal positions.
        const offset = (petal.phase * petal.duration + now) % petal.duration;
        const animation = el.animate(petal.keyframes, {
          duration: petal.duration,
          delay: -offset,
          iterations: Infinity,
          easing: "linear",
        });
        animation.playbackRate = RATE_STEPS[stepRef.current];
        return animation;
      });
    };
    const stop = () => {
      for (const animation of animationsRef.current) animation.cancel();
      animationsRef.current = [];
    };

    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { rootMargin: "120px 0px" }
    );
    observer.observe(container);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [petals]);

  // Petals ride the music: when a song swells, the flurry speeds up, then
  // eases back to its lazy drift. updatePlaybackRate keeps each petal's
  // position continuous, so nothing jumps.
  const { level } = useMusicPulse();
  useMotionValueEvent(level, "change", (value) => {
    let step = stepRef.current;
    while (step < STEP_UP.length && value > STEP_UP[step] + HYSTERESIS) step++;
    while (step > 0 && value < STEP_UP[step - 1] - HYSTERESIS) step--;
    if (step === stepRef.current) return;
    stepRef.current = step;
    for (const animation of animationsRef.current) animation.updatePlaybackRate(RATE_STEPS[step]);
  });

  return (
    <div ref={containerRef} className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      {petals.map((p) => (
        <span key={p.id} className="petal" style={p.style} />
      ))}
    </div>
  );
}
