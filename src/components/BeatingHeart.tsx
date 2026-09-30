"use client";

import { useRef } from "react";
import { motion, useInView, useTransform } from "motion/react";
import { HeartIcon } from "./doodles";
import { useMusicPulse } from "./MusicProvider";

// Only mounted while the heart is on screen — there's one in almost every
// section, and each rewrites its transform every frame while a song plays.
function Pulse({ className }: { className: string }) {
  const { level, beat } = useMusicPulse();
  const scale = useTransform(() => 1 + beat.get() * 0.3 + level.get() * 0.06);

  return (
    <motion.span className="inline-flex will-change-transform" style={{ scale }}>
      <HeartIcon className={className} />
    </motion.span>
  );
}

// The same heart as HeartIcon, but it thumps on every beat of whatever song
// is playing — and sits perfectly still (identical to HeartIcon) when paused.
export function BeatingHeart({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const onScreen = useInView(ref, { margin: "80px" });

  return (
    <span ref={ref} aria-hidden className="inline-flex flex-shrink-0">
      {onScreen ? <Pulse className={className} /> : <HeartIcon className={className} />}
    </span>
  );
}
