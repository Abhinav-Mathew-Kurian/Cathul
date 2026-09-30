"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { wedding } from "@/content/wedding";
import { HeartIcon } from "./doodles";
import { BeatingHeart } from "./BeatingHeart";
import { FallingPetals } from "./FallingPetals";
import { StringLights } from "./StringLights";

// One word of the letter. It sits faint on the page like pencil, then inks
// in as its paragraph's scroll progress reaches its slot in the sentence.
function InkedWord({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  const y = useTransform(progress, range, [4, 0]);

  return (
    <motion.span style={{ opacity, y }} className="inline-block">
      {word}
    </motion.span>
  );
}

// Each paragraph tracks its own position in the viewport, so the words ink
// in right where the reader's eye is — however tall the letter grows.
function InkedParagraph({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.88", "end 0.6"],
  });
  const words = text.split(" ");

  return (
    <p ref={ref} className="font-hand text-2xl leading-relaxed text-ink/85">
      {words.map((word, i) => {
        const start = i / words.length;
        const end = Math.min(start + 1.5 / words.length, 1);
        return (
          <span key={i}>
            <InkedWord word={word} progress={scrollYProgress} range={[start, end]} />
            {i < words.length - 1 && " "}
          </span>
        );
      })}
    </p>
  );
}

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

  return (
    <section id="note" className="note-bg relative overflow-hidden px-5 pt-16 pb-16">
      <StringLights seedOffset={600} />
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
          <BeatingHeart className="h-5 w-5 text-rose" />
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
              {wedding.note.body.map((paragraph) => (
                <InkedParagraph key={paragraph} text={paragraph} />
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mt-7"
            >
              <p className="font-hand text-2xl text-ink/70">{wedding.note.signOff}</p>
              <p className="mt-1 flex items-center gap-2 font-script text-4xl text-rose-deep">
                {wedding.couple.groom} &amp; {wedding.couple.bride}
                <span className="font-body text-2xl">{wedding.note.signatureEmoji}</span>
              </p>
            </motion.div>
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
