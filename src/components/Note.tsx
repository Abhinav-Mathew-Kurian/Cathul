"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { wedding } from "@/content/wedding";
import { HeartIcon } from "./doodles";
import { FallingPetals } from "./FallingPetals";

export function Note() {
  const paperRef = useRef<HTMLDivElement>(null);

  // Tied to actual scroll position (not a one-shot whileInView trigger) —
  // the page unfolds in stages as it rises through the viewport, like
  // someone opening a folded letter as they read it.
  const { scrollYProgress } = useScroll({
    target: paperRef,
    offset: ["start 0.95", "start 0.3"],
  });

  const rotateX = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [-55, -22, -6, 0]);
  const scaleY = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [0.6, 0.8, 0.92, 1]);
  const paperOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  const line1Opacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1]);
  const line2Opacity = useTransform(scrollYProgress, [0.4, 0.6], [0, 1]);
  const line3Opacity = useTransform(scrollYProgress, [0.65, 0.82], [0, 1]);
  const signatureOpacity = useTransform(scrollYProgress, [0.85, 1], [0, 1]);
  const signatureY = useTransform(scrollYProgress, [0.85, 1], [10, 0]);

  return (
    <section className="note-bg relative overflow-hidden px-5 pt-16 pb-16">
      <FallingPetals count={7} seedOffset={600} className="absolute inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-md">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center gap-2 text-center font-hand text-4xl text-ink sm:text-5xl"
        >
          {wedding.note.heading}
          <HeartIcon className="h-5 w-5 text-rose" />
        </motion.h2>

        <div ref={paperRef} className="relative mt-10" style={{ perspective: 1200 }}>
          {/* A second sheet peeking out behind — suggests this page was
              torn off a pad rather than being a lone card. */}
          <div
            aria-hidden
            className="torn-paper-top absolute inset-x-3 top-2 h-full bg-cream-deep/70"
            style={{ transform: "rotate(-2deg)" }}
          />

          <motion.div
            style={{ rotateX, scaleY, opacity: paperOpacity, transformOrigin: "top center" }}
            className="torn-paper-top ruled-paper relative bg-cream px-7 pt-10 pb-9 shadow-[var(--card-shadow)]"
          >
            <div className="space-y-4">
              <motion.p
                style={{ opacity: line1Opacity }}
                className="font-hand text-2xl leading-relaxed text-ink/85"
              >
                {wedding.note.body[0]}
              </motion.p>
              <motion.p
                style={{ opacity: line2Opacity }}
                className="font-hand text-2xl leading-relaxed text-ink/85"
              >
                {wedding.note.body[1]}
              </motion.p>
              <motion.p
                style={{ opacity: line3Opacity }}
                className="font-hand text-2xl leading-relaxed text-ink/85"
              >
                {wedding.note.body[2]}
              </motion.p>
            </div>

            <motion.p
              style={{ opacity: signatureOpacity, y: signatureY }}
              className="mt-7 flex items-center gap-2 font-script text-4xl text-rose-deep"
            >
              {wedding.couple.groom} &amp; {wedding.couple.bride}
              <HeartIcon className="h-4 w-4 flex-shrink-0 text-rose" />
            </motion.p>
          </motion.div>
        </div>

        <p className="mt-8 text-center font-body text-base font-semibold text-ink/70">
          {wedding.note.closing.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
          <HeartIcon className="ml-1.5 mt-1 inline-block h-4 w-4 -translate-y-0.5 text-rose" />
        </p>
      </div>
    </section>
  );
}
