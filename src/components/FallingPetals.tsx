"use client";

import { useMemo, useRef, type CSSProperties } from "react";
import { useMotionValueEvent } from "motion/react";
import { useMusicPulse } from "./MusicProvider";

// Deterministic pseudo-randomness (no Math.random) so this stays a pure
// render — each petal's trajectory comes from its own index instead.
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const PETAL_COLORS = ["var(--rose)", "#e6a99b", "#f6d9ce", "var(--dusk)"];

type PetalStyle = CSSProperties & Record<`--${string}`, string | number>;

type FallingPetalsProps = {
  /** How many petals to render — lower this in denser/text-heavy sections. */
  count?: number;
  /** Shifts every petal's seed so two instances on the same page never share a trajectory. */
  seedOffset?: number;
  /** Positioning + stacking for the wrapper — callers control where petals sit in their own layer stack. */
  className?: string;
};

export function FallingPetals({
  count = 18,
  seedOffset = 0,
  className = "absolute inset-0 z-0",
}: FallingPetalsProps) {
  const petals = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const seed = i + seedOffset;
      // Alternate spin direction so roughly half the petals turn clockwise
      // and half counter-clockwise, instead of every petal spinning the same way.
      const spin = seeded(seed, 7) > 0.5 ? 1 : -1;
      const duration = 10 + seeded(seed, 3) * 10;

      const style: PetalStyle = {
        "--start-x": `${Math.round(seeded(seed, 1) * 100)}%`,
        "--size": `${(6 + seeded(seed, 2) * 10).toFixed(1)}px`,
        "--duration": `${duration.toFixed(2)}s`,
        // Negative delays start each petal mid-flight at mount, so the sky
        // already feels alive instead of every petal bursting from the top together.
        "--delay": `${(-seeded(seed, 4) * duration).toFixed(2)}s`,
        "--drift": `${Math.round(spin * (16 + seeded(seed, 5) * 48))}px`,
        "--rotate": `${Math.round(spin * (150 + seeded(seed, 6) * 380))}deg`,
        "--scale-start": (0.5 + seeded(seed, 8) * 0.25).toFixed(2),
        "--scale-mid": (0.85 + seeded(seed, 9) * 0.35).toFixed(2),
        "--scale-end": (0.65 + seeded(seed, 10) * 0.3).toFixed(2),
        "--opacity-peak": (0.5 + seeded(seed, 11) * 0.4).toFixed(2),
        "--petal-color": PETAL_COLORS[i % PETAL_COLORS.length],
        "--petal-radius": i % 3 === 0 ? "50% 50% 50% 10%" : "70% 30% 65% 35%",
      };

      return { id: seed, style };
    });
  }, [count, seedOffset]);

  // Petals ride the music: when a song swells, the whole flurry speeds up
  // and flutters harder, then eases back to its lazy drift. updatePlaybackRate
  // keeps each petal's position continuous, so nothing jumps. Throttled to
  // meaningful changes — this fires every frame while music plays.
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRateRef = useRef(1);
  const { level } = useMusicPulse();
  useMotionValueEvent(level, "change", (value) => {
    const rate = 1 + value * 1.4;
    if (Math.abs(rate - lastRateRef.current) < 0.06 && !(rate === 1 && lastRateRef.current !== 1)) return;
    lastRateRef.current = rate;
    const container = containerRef.current;
    if (!container || typeof container.getAnimations !== "function") return;
    for (const animation of container.getAnimations({ subtree: true })) {
      animation.updatePlaybackRate(rate);
    }
  });

  return (
    <div ref={containerRef} className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      {petals.map((p) => (
        <span key={p.id} className="petal" style={p.style} />
      ))}
    </div>
  );
}
