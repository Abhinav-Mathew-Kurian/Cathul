"use client";

import { memo, useRef } from "react";
import { useInView } from "motion/react";
import { HeartIcon } from "./doodles";
import { usePulse } from "./MusicProvider";

// Only mounted while the heart is on screen — there's one in almost every
// section. The thump itself is a compositor animation (see lib/pulse.ts).
function Pulse({ className }: { className: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  usePulse(ref, "heart");

  return (
    <span ref={ref} className="inline-flex">
      <HeartIcon className={className} />
    </span>
  );
}

// The same heart as HeartIcon, but it thumps on every beat of whatever song
// is playing — and sits perfectly still (identical to HeartIcon) when paused.
function BeatingHeartImpl({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const onScreen = useInView(ref, { margin: "80px" });

  return (
    <span ref={ref} aria-hidden className="inline-flex flex-shrink-0">
      {onScreen ? <Pulse className={className} /> : <HeartIcon className={className} />}
    </span>
  );
}

// Memoized: purely decorative with constant props, so a parent re-render
// (an RSVP keystroke, a music state change) never re-renders it.
export const BeatingHeart = memo(BeatingHeartImpl);

