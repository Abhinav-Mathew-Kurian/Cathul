"use client";

import { useState } from "react";
import { motion, type Easing } from "motion/react";
import { HeartIcon } from "./doodles";

// One drive-by: roll in from the left, pause mid-card for a "beep beep!",
// then drive off to the right. Every piece of the car shares these
// timestamps so the wheels only turn while it's actually moving.
const DRIVE = { duration: 5, times: [0, 0.3, 0.66, 1] };
const DRIVE_EASE: Easing[] = ["easeOut", "linear", "easeIn"];

const CANS = [
  { x: 6, y: 58, delay: 0 },
  { x: -10, y: 60, delay: 0.09 },
  { x: -25, y: 57, delay: 0.17 },
];

function Wheel({ cx }: { cx: number }) {
  return (
    <g transform={`translate(${cx} 66)`}>
      <circle r="12" fill="var(--ink)" />
      <motion.g
        initial={{ rotate: 0 }}
        animate={{ rotate: [0, 900, 900, 1800] }}
        transition={{ ...DRIVE, ease: DRIVE_EASE }}
      >
        <circle r="6.5" fill="var(--cream)" />
        <path d="M0-6.5V6.5M-6.5 0H6.5" stroke="var(--ink-soft)" strokeWidth="1.6" />
      </motion.g>
    </g>
  );
}

// A little retro getaway car, drawn facing right, with the couple in the
// windows, a "Just Married" plate on the back and tin cans on strings.
function CarArt() {
  return (
    <svg viewBox="-40 0 260 90" className="h-full w-full overflow-visible" aria-hidden>
      {/* Strings + cans bouncing along behind */}
      {CANS.map((can) => (
        <motion.g
          key={can.x}
          animate={{ y: [0, -5, 0, -2, 0] }}
          transition={{ duration: 0.42, repeat: Infinity, delay: can.delay, ease: "easeInOut" }}
        >
          <path d={`M26 58 Q ${(26 + can.x) / 2} ${can.y + 8} ${can.x + 8} ${can.y + 4}`} fill="none" stroke="var(--ink-soft)" strokeWidth="0.9" />
          <rect x={can.x} y={can.y} width="8" height="10" rx="1.5" fill="#c9ced8" stroke="var(--ink-soft)" strokeWidth="0.8" />
          <path d={`M${can.x} ${can.y + 3}h8`} stroke="var(--ink-soft)" strokeWidth="0.6" />
        </motion.g>
      ))}

      {/* Body bobs on its suspension */}
      <motion.g animate={{ y: [0, -1.6, 0] }} transition={{ duration: 0.34, repeat: Infinity, ease: "easeInOut" }}>
        <path
          d="M28 64 L28 50 Q29 42 40 40 L64 38 L82 22 Q86 18 94 18 L138 18 Q147 18 153 25 L168 40 L194 44 Q205 46 205 56 L205 64 Z"
          fill="var(--rose)"
        />
        {/* Windows, with the two of them inside */}
        <path d="M70 38 L86 24 Q88 22 92 22 L112 22 L112 38 Z" fill="var(--sky-bottom)" />
        <path d="M117 22 L136 22 Q143 22 148 28 L158 38 L117 38 Z" fill="var(--sky-bottom)" />
        <circle cx="100" cy="31" r="5" fill="var(--ink)" />
        <circle cx="130" cy="31" r="5" fill="#5a3a2e" />
        <path d="M125 29 q5 -7 10 0" fill="#5a3a2e" />
        {/* Trim + lights */}
        <path d="M28 52 H205" stroke="var(--rose-deep)" strokeWidth="1.2" />
        <rect x="196" y="47" width="8" height="5" rx="2" fill="var(--bulb-glow)" />
        <rect x="28" y="46" width="5" height="6" rx="1.5" fill="#ffb4a2" />
        {/* The sign */}
        <g transform="rotate(-4 52 49)">
          <rect x="29" y="42" width="46" height="14" rx="3" fill="var(--cream)" stroke="var(--rose-deep)" strokeWidth="0.8" />
          <text x="52" y="52.5" textAnchor="middle" className="font-script" fontSize="10.5" fill="var(--rose-deep)">
            Just Married
          </text>
        </g>
      </motion.g>

      <Wheel cx={62} />
      <Wheel cx={172} />
    </svg>
  );
}

export function JustMarriedCar() {
  // Tapping the car sends it round again.
  const [lap, setLap] = useState(0);

  return (
    <button
      type="button"
      onClick={() => setLap((n) => n + 1)}
      aria-label="Just Married car — tap to send it round again"
      className="relative block h-28 w-full overflow-hidden"
    >
      <motion.span
        key={lap}
        className="absolute bottom-1 left-1/2 block h-24 w-60 -ml-30"
        initial={{ x: "-150%" }}
        animate={{ x: ["-150%", "0%", "0%", "170%"] }}
        transition={{ ...DRIVE, ease: DRIVE_EASE }}
      >
        {/* Exhaust hearts puffing out the back while it waits */}
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute left-[50px] top-[46px] text-rose"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 0], x: [0, 0, -14 - i * 6, -26 - i * 8], y: [0, 0, -10, -28 - i * 6] }}
            transition={{ duration: DRIVE.duration, times: [0, 0.32 + i * 0.08, 0.4 + i * 0.08, 0.6 + i * 0.05] }}
          >
            <HeartIcon className="h-3 w-3" />
          </motion.span>
        ))}

        <motion.span
          className="absolute -top-3 right-0 block rounded-full bg-white px-2.5 py-1 font-hand text-base leading-none text-ink shadow-[var(--card-shadow)]"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.6, 0.6, 1, 1, 0.8] }}
          transition={{ duration: DRIVE.duration, times: [0, 0.33, 0.37, 0.6, 0.64] }}
        >
          beep beep!
        </motion.span>

        <CarArt />
      </motion.span>
    </button>
  );
}
