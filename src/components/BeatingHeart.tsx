"use client";

import { motion, useTransform } from "motion/react";
import { HeartIcon } from "./doodles";
import { useMusicPulse } from "./MusicProvider";

// The same heart as HeartIcon, but it thumps on every beat of whatever song
// is playing — and sits perfectly still (identical to HeartIcon) when paused.
export function BeatingHeart({ className = "" }: { className?: string }) {
  const { level, beat } = useMusicPulse();
  const scale = useTransform(() => 1 + beat.get() * 0.3 + level.get() * 0.06);

  return (
    <motion.span aria-hidden className="inline-flex flex-shrink-0" style={{ scale }}>
      <HeartIcon className={className} />
    </motion.span>
  );
}
