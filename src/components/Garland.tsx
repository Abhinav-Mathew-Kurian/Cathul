"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

const WIDTH = 400;
const MARK_POSITIONS = [40, 120, 200, 280, 360];

function GarlandMark({
  markX,
  progress,
  index,
}: {
  markX: number;
  progress: MotionValue<number>;
  index: number;
}) {
  const t = markX / WIDTH;
  const opacity = useTransform(progress, [t, t + 0.08], [0, 1]);
  const scale = useTransform(progress, [t, t + 0.08], [0.4, 1]);
  const isLeaf = index % 2 === 1;

  return (
    <motion.g style={{ opacity, scale, x: markX, y: 30 }}>
      {isLeaf ? (
        <path
          d="M0,-5 C3.5,-5 6,-1.5 6,2 C6,5.5 2.5,8 0,9.5 C-2.5,8 -6,5.5 -6,2 C-6,-1.5 -3.5,-5 0,-5 Z"
          fill="var(--leaf)"
          transform={`rotate(${index * 35})`}
        />
      ) : (
        <circle r={3.4} fill="var(--rose)" />
      )}
    </motion.g>
  );
}

// A garland that strings itself along its length as the section it sits in
// scrolls into view — a drawn SVG line rather than a one-shot reveal.
export function Garland({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.9", "start 0.35"],
  });
  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} className={`pointer-events-none ${className}`} aria-hidden="true">
      <svg viewBox={`0 0 ${WIDTH} 60`} className="w-full" preserveAspectRatio="none">
        <motion.path
          d="M0 30 Q 40 55 80 30 T 160 30 T 240 30 T 320 30 T 400 30"
          fill="none"
          stroke="var(--rose)"
          strokeWidth={2}
          strokeLinecap="round"
          style={{ pathLength }}
        />
        {MARK_POSITIONS.map((markX, i) => (
          <GarlandMark key={markX} markX={markX} progress={scrollYProgress} index={i} />
        ))}
      </svg>
    </div>
  );
}
