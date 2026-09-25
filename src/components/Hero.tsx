"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { wedding } from "@/content/wedding";
import { HeartIcon, WaveDivider } from "./doodles";
import { BeatingHeart } from "./BeatingHeart";
import { FallingPetals } from "./FallingPetals";
import { useGateRevealed } from "./InvitationGate";

// When the hero's entrance starts, relative to the invitation beginning to
// open — the gatefold is still mid-swing, so the page assembles behind it.
const T = { heading: 0.35, portrait: 0.5, card: 0.7, firstName: 1.05, heart: 2.0, secondName: 2.1 };

// A name that signs itself: each glyph's outline is traced like a pen stroke
// (a dash pattern sliding along the letterform), then the ink floods in.
function SignedName({ text, delay, play }: { text: string; delay: number; play: boolean }) {
  return (
    <svg viewBox="0 0 300 56" role="img" aria-label={text} className="mx-auto block h-14 w-[300px] max-w-full overflow-visible">
      <motion.text
        x="150"
        y="43"
        textAnchor="middle"
        className="font-display"
        fontSize="48"
        fontWeight={500}
        fill="var(--ink)"
        stroke="var(--ink)"
        strokeWidth={0.7}
        strokeLinejoin="round"
        strokeDasharray="700"
        initial={{ strokeDashoffset: 700, fillOpacity: 0 }}
        animate={play ? { strokeDashoffset: 0, fillOpacity: 1 } : { strokeDashoffset: 700, fillOpacity: 0 }}
        transition={{
          strokeDashoffset: { duration: 1.6, delay, ease: [0.45, 0, 0.25, 1] },
          fillOpacity: { duration: 0.7, delay: delay + 0.95, ease: "easeOut" },
        }}
      >
        {text}
      </motion.text>
    </svg>
  );
}

function getTimeLeft(target: string) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function Countdown() {
  // Starts null so the server-rendered markup has no time-dependent value —
  // the real countdown fills in after mount, avoiding a hydration mismatch
  // against whatever second the client happens to render on.
  const [time, setTime] = useState<ReturnType<typeof getTimeLeft> | null>(null);

  useEffect(() => {
    const tick = () => setTime(getTimeLeft(wedding.weddingDate));
    const kick = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);

  if (time && time.days === 0 && time.hours === 0 && time.minutes === 0 && time.seconds === 0) {
    return (
      <div className="mt-4 flex items-center justify-center rounded-2xl border border-ink/10 bg-white px-4 py-4 shadow-[var(--card-shadow)]">
        <p className="font-display text-lg font-semibold text-ink">
          Today is the day! <HeartIcon className="inline-block h-4 w-4 -translate-y-0.5 text-rose" />
        </p>
      </div>
    );
  }

  const units = [
    { label: "Days", value: time?.days },
    { label: "Hours", value: time?.hours },
    { label: "Mins", value: time?.minutes },
    { label: "Secs", value: time?.seconds },
  ];

  return (
    <div className="mt-4 flex items-stretch justify-between rounded-2xl border border-ink/10 bg-white px-2 py-3 shadow-[var(--card-shadow)]">
      {units.map((u, i) => (
        <div key={u.label} className="flex flex-1 items-center">
          <div className="flex flex-1 flex-col items-center px-1">
            <span className="font-display text-2xl font-bold text-ink tabular-nums">
              {u.value === undefined ? "--" : String(u.value).padStart(2, "0")}
            </span>
            <span className="mt-0.5 whitespace-nowrap text-[9px] font-semibold uppercase text-ink/40">
              {u.label}
            </span>
          </div>
          {i < units.length - 1 && <span className="h-8 w-px flex-shrink-0 bg-ink/10" />}
        </div>
      ))}
    </div>
  );
}

export function Hero() {
  const [headingLine1, headingLine2] = wedding.hero.heading.split(" ");
  const revealed = useGateRevealed();

  return (
    <section className="relative isolate flex h-svh min-h-[640px] flex-col overflow-hidden">
      {/* Layer 1 — tropical landscape backdrop, anchored to the bottom of the hero */}
      <div className="absolute inset-x-0 bottom-0 z-[1] h-[38%] w-full">
        <Image
          src="/images/decor/landscape-footer.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-top"
        />
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-sky-bottom to-transparent" />
        {/* Fades the illustration's ocean edge into the exact color Our Story
            opens with (--sky-bottom), so the two sections join with no seam. */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-sky-bottom to-transparent" />
      </div>

      {/* Layer 3 — heading + couple portrait */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={revealed ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.7, delay: T.heading, ease: "easeOut" }}
        className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center pt-[max(1.75rem,env(safe-area-inset-top))]"
      >
        <h1 className="font-hand text-center text-[2.6rem] leading-[0.9] font-semibold text-ink sm:text-5xl">
          <span className="block">{headingLine1}</span>
          <span className="block">{headingLine2}</span>
        </h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={revealed ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 0.7, delay: T.portrait, ease: "easeOut" }}
          className="relative mx-4 mt-4 h-60 w-[calc(100%-2rem)] flex-shrink-0 overflow-hidden rounded-[2rem] shadow-[var(--card-shadow)]"
        >
          {/* A slow cinematic push-out as the portrait settles in. */}
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.14 }}
            animate={revealed ? { scale: 1 } : undefined}
            transition={{ duration: 2.6, delay: T.portrait, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Image
              src="/images/couple-portrait.jpg"
              alt={`${wedding.couple.groom} and ${wedding.couple.bride}`}
              fill
              sizes="(max-width: 640px) 100vw, 560px"
              priority
              className="object-cover object-[50%_22%]"
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Layer 4 — white paper card, overlapping the couple with an organic top edge */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={revealed ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.6, delay: T.card, ease: "easeOut" }}
        className="relative z-20 mx-auto -mt-8 w-full max-w-md"
      >
        <div className="mx-4 flex flex-col">
          <WaveDivider className="h-6 w-full text-cream" />
          <div className="rounded-b-[1.75rem] bg-cream px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1 text-center shadow-[var(--card-shadow)]">
            <SignedName text={wedding.couple.groom} delay={T.firstName} play={revealed} />
            <div className="my-1 flex items-center justify-center gap-2">
              <motion.span
                className="h-px w-7 origin-right bg-ink/20"
                initial={{ scaleX: 0 }}
                animate={revealed ? { scaleX: 1 } : undefined}
                transition={{ duration: 0.5, delay: T.heart - 0.1, ease: "easeOut" }}
              />
              <motion.span
                className="inline-flex"
                initial={{ scale: 0, rotate: -30 }}
                animate={revealed ? { scale: 1, rotate: 0 } : undefined}
                transition={{ type: "spring", stiffness: 380, damping: 11, delay: T.heart }}
              >
                <BeatingHeart className="h-4 w-4 text-rose" />
              </motion.span>
              <motion.span
                className="h-px w-7 origin-left bg-ink/20"
                initial={{ scaleX: 0 }}
                animate={revealed ? { scaleX: 1 } : undefined}
                transition={{ duration: 0.5, delay: T.heart - 0.1, ease: "easeOut" }}
              />
            </div>
            <SignedName text="Catherine" delay={T.secondName} play={revealed} />

            <p className="mt-3 font-body text-sm text-ink/65">{wedding.tagline}</p>

            <Countdown />

            <a
              href="#story"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-rose px-6 py-3.5 font-body text-sm font-bold text-white shadow-[var(--card-shadow)] transition hover:bg-rose-deep"
            >
              Scroll to Explore ↓
            </a>
          </div>
        </div>
      </motion.div>

      {/* Layer 5 — falling petals, topmost layer in the stack */}
      <FallingPetals className="absolute inset-0 z-30" />
    </section>
  );
}
