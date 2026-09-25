"use client";

import { Fragment, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import Image from "next/image";
import { wedding, type StoryMoment } from "@/content/wedding";
import { burst, haptic } from "@/lib/burst";
import { HeartIcon } from "./doodles";
import { BeatingHeart } from "./BeatingHeart";
import { FallingPetals } from "./FallingPetals";
import { StringLights } from "./StringLights";

const VIEWPORT = { once: true, margin: "-60px" } as const;

// A little alternating tilt per milestone keeps the column of photos from
// reading like a uniform grid — each one sits like it was pinned in by hand.
const PHOTO_TILT = [-4, 3, -3, 4, -2];

// No real per-stage illustration yet — a soft organic vignette holds its
// place so the timeline still reads as illustrated, not empty.
function StoryVignette({ moment, tilt }: { moment: StoryMoment; tilt: number }) {
  if (!moment.image) {
    return (
      <div
        aria-hidden
        className="flex h-28 w-28 flex-shrink-0 items-center justify-center bg-gradient-to-br from-sky-bottom to-cream-deep/60"
        style={{ borderRadius: "44% 56% 58% 42% / 55% 44% 56% 45%", transform: `rotate(${tilt}deg)` }}
      >
        <HeartIcon className="h-6 w-6 text-rose/35" />
      </div>
    );
  }

  return (
    <div className="relative h-28 w-28 flex-shrink-0">
      <div
        className="photo-vignette absolute inset-0 drop-shadow-[0_10px_18px_rgba(30,42,68,0.18)]"
        style={{ transform: `rotate(${tilt}deg)` }}
      >
        <Image src={moment.image} alt={moment.title} fill sizes="112px" className="object-contain" />
      </div>
    </div>
  );
}

function StoryTimelineItem({
  moment,
  tilt,
  delay,
  row,
}: {
  moment: StoryMoment;
  tilt: number;
  delay: number;
  row: number;
}) {
  return (
    <>
      <div className="col-start-1 flex flex-col items-center" style={{ gridRow: row }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
          whileInView={{ opacity: 1, scale: 1, rotate: tilt }}
          viewport={VIEWPORT}
          transition={{ duration: 0.65, delay, ease: "easeOut" }}
        >
          <StoryVignette moment={moment} tilt={tilt} />
        </motion.div>
      </div>

      <div className="col-start-2 flex justify-center pt-2" style={{ gridRow: row }}>
        <motion.span
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.4, delay: delay + 0.25, ease: "easeOut" }}
          className="h-3.5 w-3.5 rounded-full bg-rose shadow-[0_0_0_5px_rgba(193,89,74,0.16)]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.65, delay: delay + 0.3, ease: "easeOut" }}
        className="col-start-3 pt-3"
        style={{ gridRow: row }}
      >
        <h3 className="font-hand text-[1.7rem] leading-none font-bold text-ink">{moment.title}</h3>
        <p className="mt-1.5 font-body text-sm leading-relaxed text-ink/60">
          {moment.description.map((line, i) => (
            <span key={line}>
              {line}
              {i < moment.description.length - 1 && <br />}
            </span>
          ))}
        </p>
      </motion.div>
    </>
  );
}

// A soft warm glow that drifts down the timeline's connecting line as the
// section scrolls past — its blur is wide enough to wash over whichever
// dot marker it's nearest, without needing to track individual moments.
function TravelingGlow({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.8", "end 0.5"],
  });
  const top = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-[calc(7rem+0.75rem)] z-20 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        top,
        background: "radial-gradient(circle, var(--bulb-glow) 0%, transparent 70%)",
        filter: "blur(8px)",
      }}
    />
  );
}

// Where the timeline's line runs: column 1 (7rem) + the column gap (0.5rem)
// + half of the 1.5rem dot column.
const LINE_X = "calc(7rem + 0.5rem + 0.75rem)";
// How many times the two hearts cross over each other on the way down.
const TWISTS = 5;

// Two hearts — one for each of them — wind down the timeline around each
// other as the story scrolls past, drifting closer with every milestone
// until they meet at "Here we are" and become one.
function IntertwinedHearts({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.75", "end 0.6"],
  });
  // A little spring lag so the hearts glide rather than stick to the scrollbar.
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.5 });
  const top = useTransform(progress, [0, 1], ["0%", "100%"]);

  // Opposite sine waves around the line; the swing holds wide for most of the
  // story and only closes to nothing near the end (1 - v², not 1 - v).
  const weave = (v: number) => Math.sin(v * Math.PI * 2 * TWISTS) * 20 * (1 - v * v);
  const hisX = useTransform(progress, (v) => weave(v));
  const herX = useTransform(progress, (v) => -weave(v));
  // Whichever heart is swinging toward the viewer draws on top, for a real over-under twist.
  const hisZ = useTransform(progress, (v) => (Math.cos(v * Math.PI * 2 * TWISTS) > 0 ? 2 : 1));
  const herZ = useTransform(progress, (v) => (Math.cos(v * Math.PI * 2 * TWISTS) > 0 ? 1 : 2));
  const depth = (sign: number) => (v: number) => 1 + sign * Math.cos(v * Math.PI * 2 * TWISTS) * 0.2 * (1 - v * v);
  const hisScale = useTransform(progress, depth(1));
  const herScale = useTransform(progress, depth(-1));

  const [together, setTogether] = useState(false);
  const meetRef = useRef<HTMLDivElement>(null);

  useMotionValueEvent(progress, "change", (v) => {
    if (!together && v > 0.985) {
      setTogether(true);
      const rect = meetRef.current?.getBoundingClientRect();
      if (rect) {
        burst({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          count: 28,
          speed: 420,
          shapes: ["heart"],
          colors: ["#c1594a", "#e6a99b", "#8ca4c4", "#f6d9ce"],
          size: [8, 13],
          life: 2.4,
        });
      }
      haptic(18);
    } else if (together && v < 0.85) {
      // Scrolled back up: split them apart again so the meeting can replay.
      setTogether(false);
    }
  });

  return (
    <motion.div
      ref={meetRef}
      aria-hidden
      className="pointer-events-none absolute z-20 h-0 w-0"
      style={{ top, left: LINE_X }}
    >
      <AnimatePresence initial={false}>
        {together ? (
          <motion.div
            key="one"
            className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 12 }}
          >
            {/* A ring rippling out from the moment they meet. */}
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-rose"
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
            <BeatingHeart className="h-7 w-7 text-rose drop-shadow-[0_2px_6px_rgba(193,89,74,0.45)]" />
          </motion.div>
        ) : (
          <motion.div
            key="two"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <motion.div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ x: hisX, scale: hisScale, zIndex: hisZ }}>
              <BeatingHeart className="h-4 w-4 text-dusk-deep drop-shadow-[0_1px_3px_rgba(30,42,68,0.3)]" />
            </motion.div>
            <motion.div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ x: herX, scale: herScale, zIndex: herZ }}>
              <BeatingHeart className="h-4 w-4 text-rose drop-shadow-[0_1px_3px_rgba(30,42,68,0.3)]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StoryEnding() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative -mx-5 mt-14 h-80 overflow-hidden sm:h-96"
    >
      <Image
        src={wedding.story.endingImage}
        alt="Athul and Catherine, seen from behind, looking out at the ocean at sunset"
        fill
        sizes="(max-width: 640px) 100vw, 500px"
        loading="lazy"
        className="object-cover object-[56%_40%]"
      />

      {/* Soft hand-off from the section's flat blue into the illustration,
          so the photo reads as a continuation of the page, not a card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[var(--sky-bottom)] to-transparent"
      />

      <div className="absolute inset-x-0 top-6 flex flex-col items-center gap-0.5 px-6 text-center sm:top-8">
        {wedding.story.closing.map((line, i) => {
          const isMiddle = i === 1;
          return (
            <p
              key={line}
              className="flex items-center gap-2 font-hand text-2xl leading-tight text-ink sm:text-3xl"
            >
              {isMiddle && <HeartIcon className="h-3 w-3 flex-shrink-0 text-rose/60" />}
              {line}
              {isMiddle && <HeartIcon className="h-3 w-3 flex-shrink-0 text-rose/60" />}
            </p>
          );
        })}
      </div>
    </motion.div>
  );
}

export function OurStory() {
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <section id="story" className="story-bg relative overflow-hidden px-5 pt-16 pb-6">
      <StringLights seedOffset={100} />
      <FallingPetals count={10} seedOffset={100} className="absolute inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="flex items-center justify-center gap-2 font-hand text-4xl text-ink sm:text-5xl">
            {wedding.story.heading}
            <BeatingHeart className="h-5 w-5 text-rose" />
          </h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-ink/60">
            {wedding.story.subheading.map((line, i) => (
              <Fragment key={line}>
                {line}
                {i < wedding.story.subheading.length - 1 && <br />}
              </Fragment>
            ))}
          </p>
        </motion.div>

        <div ref={gridRef} className="relative mt-12 grid grid-cols-[7rem_1.5rem_1fr] gap-x-2 gap-y-12">
          {/* Explicit row count (not "1 / -1") — leaving the span implicit made
              some mobile WebViews auto-place the first row's items a row off
              from this line, breaking the very first entry's alignment. */}
          <div
            aria-hidden
            className="col-start-2 mx-auto w-px bg-gradient-to-b from-dusk/50 via-rose/35 to-rose/55"
            style={{ gridRow: `1 / ${wedding.story.moments.length + 1}` }}
          />

          <TravelingGlow containerRef={gridRef} />
          <IntertwinedHearts containerRef={gridRef} />

          {wedding.story.moments.map((moment, i) => (
            <Fragment key={moment.year}>
              <StoryTimelineItem
                moment={moment}
                tilt={PHOTO_TILT[i % PHOTO_TILT.length]}
                delay={Math.min(i * 0.08, 0.32)}
                row={i + 1}
              />
            </Fragment>
          ))}
        </div>

        <StoryEnding />
      </div>
    </section>
  );
}
