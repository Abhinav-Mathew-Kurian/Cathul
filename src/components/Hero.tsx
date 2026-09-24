"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { wedding } from "@/content/wedding";
import { HeartIcon, WaveDivider } from "./doodles";
import { FallingPetals } from "./FallingPetals";

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
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center pt-[max(1.75rem,env(safe-area-inset-top))]"
      >
        <h1 className="font-hand text-center text-[2.6rem] leading-[0.9] font-semibold text-ink sm:text-5xl">
          <span className="block">{headingLine1}</span>
          <span className="block">{headingLine2}</span>
        </h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="relative mx-4 mt-4 h-60 w-[calc(100%-2rem)] flex-shrink-0 overflow-hidden rounded-[2rem] shadow-[var(--card-shadow)]"
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

      {/* Layer 4 — white paper card, overlapping the couple with an organic top edge */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
        className="relative z-20 mx-auto -mt-8 w-full max-w-md"
      >
        <div className="mx-4 flex flex-col">
          <WaveDivider className="h-6 w-full text-cream" />
          <div className="rounded-b-[1.75rem] bg-cream px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1 text-center shadow-[var(--card-shadow)]">
            <p className="font-display text-5xl leading-none font-medium text-ink">
              {wedding.couple.groom}
            </p>
            <div className="my-2 flex items-center justify-center gap-2">
              <span className="h-px w-7 bg-ink/20" />
              <HeartIcon className="h-4 w-4 text-rose" />
              <span className="h-px w-7 bg-ink/20" />
            </div>
            <p className="font-display text-5xl leading-none font-medium text-ink">
              Catherine
            </p>

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
