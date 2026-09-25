"use client";

import { useMemo } from "react";
import { motion, useTransform } from "motion/react";
import { useMusicPulse } from "./MusicProvider";

// Deterministic pseudo-randomness (no Math.random), same trick as
// FallingPetals — each bulb's position comes from its own index so
// server and client render identically.
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const VIEWPORT = { once: true, margin: "-60px" } as const;
const WIDTH = 400;
const SWAG = 100;
const UNLIT = "#4a5975"; // matches --ink-soft
const LIT = "#ffcf7a"; // matches --bulb-glow

function wireY(x: number, amplitude: number) {
  const local = (((x % SWAG) + SWAG) % SWAG) / SWAG;
  return 15 + amplitude * Math.sin(local * Math.PI);
}

// An extra bloom on top of the lit bulb that swells with the music — neighbours
// alternate which of them flashes on each beat, so the strand "chases" in
// time with the song. Fully transparent while nothing is playing.
function BulbFlare({ index }: { index: number }) {
  const { level, beat, beatCount } = useMusicPulse();
  const opacity = useTransform(() => {
    const onBeat = (beatCount.get() + index) % 2 === 0;
    return Math.min(1, level.get() * 0.35 + beat.get() * (onBeat ? 0.75 : 0.15));
  });
  const scale = useTransform(() => 0.8 + level.get() * 0.5 + beat.get() * 0.35);

  return <motion.circle className="bulb-flare" r={10} style={{ opacity, scale }} />;
}

type StringLightsProps = {
  /** How many bulbs to string along the strand. */
  count?: number;
  /** Shifts every bulb's seed so two instances on the same page never share spacing or timing. */
  seedOffset?: number;
  /** Positioning + stacking for the wrapper — callers control where the strand sits in their own layer stack. */
  className?: string;
};

// A strand of bulbs that switches on left-to-right the moment its section
// scrolls into view — the seam between one section and the next arriving
// already lit.
export function StringLights({
  count = 8,
  seedOffset = 0,
  className = "absolute inset-x-0 top-0 z-10 h-14",
}: StringLightsProps) {
  const { wirePath, bulbs } = useMemo(() => {
    const amplitude = 16 + seeded(0, seedOffset) * 10;
    const segments = Math.max(1, Math.round(WIDTH / SWAG));
    let d = "M0 15";
    for (let s = 0; s < segments; s++) {
      const startX = s * SWAG;
      d += ` Q ${startX + SWAG / 2} ${(15 + amplitude).toFixed(1)} ${startX + SWAG} 15`;
    }

    const bulbs = Array.from({ length: count }).map((_, i) => {
      const seed = i + seedOffset;
      const x = ((i + 0.5) / count) * WIDTH + (seeded(seed, 1) - 0.5) * 14;
      const y = wireY(x, amplitude) + (seeded(seed, 2) - 0.5) * 3;
      return { id: seed, x, y, delay: i * 0.06 };
    });

    return { wirePath: d, bulbs };
  }, [count, seedOffset]);

  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <svg viewBox={`0 0 ${WIDTH} 60`} className="h-full w-full" preserveAspectRatio="none">
        <path d={wirePath} fill="none" stroke="var(--ink-soft)" strokeOpacity={0.25} strokeWidth={1} />
        {bulbs.map((b, i) => (
          <g key={b.id} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
            <motion.circle
              className="bulb-halo"
              r={7}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.55 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, delay: b.delay, ease: "easeOut" }}
            />
            <motion.circle
              className="bulb-core"
              r={3}
              initial={{ opacity: 0.5, fill: UNLIT }}
              whileInView={{ opacity: 1, fill: LIT }}
              viewport={VIEWPORT}
              transition={{ duration: 0.5, delay: b.delay, ease: "easeOut" }}
            />
            <BulbFlare index={i} />
          </g>
        ))}
      </svg>
    </div>
  );
}
