"use client";

import { Fragment, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { wedding, type Track } from "@/content/wedding";
import { HeartIcon } from "./doodles";
import { BeatingHeart } from "./BeatingHeart";
import { FallingPetals } from "./FallingPetals";
import { StringLights } from "./StringLights";
import { useMusic, useMusicProgress } from "./MusicProvider";

const VIEWPORT = { once: true, margin: "-60px" } as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function SkipBackIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  );
}

function SkipForwardIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z" />
    </svg>
  );
}

// A tiny bouncing equalizer — the "now playing" tell, and the moving detail
// inside the card the reference's static mockup couldn't show.
function EqualizerBars({ animate }: { animate: boolean }) {
  const bars = [0, 1, 2];
  return (
    <span className="flex items-end gap-0.5" aria-hidden>
      {bars.map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-rose"
          animate={animate ? { height: ["30%", "100%", "45%", "80%", "30%"] } : { height: "30%" }}
          transition={
            animate
              ? { duration: 0.9 + i * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }
              : { duration: 0.2 }
          }
          style={{ height: "30%" }}
        />
      ))}
    </span>
  );
}

// The record's own center label — shows the current track's cover, or a
// themed fallback disc when no cover exists yet (or it fails to load), so a
// missing asset never renders as a broken image. Deliberately NOT a child of
// the rotating groove ring — the photo stays upright while the ring spins.
function TrackLabel({ track }: { track: Track }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !track.cover || failed;

  return (
    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-rose to-rose-deep shadow-[0_0_0_4px_rgba(0,0,0,0.35)]">
      {showFallback ? (
        <HeartIcon className="h-9 w-9 text-white/90" />
      ) : (
        <div className="relative h-full w-full">
          <Image
            src={track.cover as string}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
            onError={() => setFailed(true)}
          />
        </div>
      )}
    </div>
  );
}

export function Music() {
  const { currentTrack, isPlaying, musicEnabled, audioError, togglePlay, goToNext, goToPrevious, toggleMusicEnabled } =
    useMusic();
  const { currentTime, duration, seek } = useMusicProgress();

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <section id="music" className="music-bg relative overflow-hidden px-5 pt-16 pb-6">
      <StringLights seedOffset={500} />
      <FallingPetals count={8} seedOffset={500} className="absolute inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="flex items-center justify-center gap-2 font-hand text-4xl text-ink sm:text-5xl">
            {wedding.music.heading}
            <BeatingHeart className="h-5 w-5 text-rose" />
          </h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-ink/60">
            {wedding.music.subheading.map((line, i) => (
              <Fragment key={line}>
                {line}
                {i < wedding.music.subheading.length - 1 && <br />}
              </Fragment>
            ))}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-8 rounded-3xl bg-[#2b2b33] p-6 shadow-[var(--card-shadow)]"
        >
          <div className="relative flex justify-center">
            {/* Soft pulsing glow — the "beautiful moving" detail behind the
                record, breathing gently only while music is actually playing. */}
            <motion.div
              aria-hidden
              className="absolute inset-0 m-auto h-40 w-40 rounded-full bg-rose/40 blur-2xl"
              animate={isPlaying ? { opacity: [0.25, 0.55, 0.25], scale: [0.9, 1.05, 0.9] } : { opacity: 0.15, scale: 0.9 }}
              transition={{ duration: 3, repeat: isPlaying ? Infinity : 0, ease: "easeInOut" }}
            />

            <div className="relative flex h-44 w-44 items-center justify-center">
              {/* Groove ring — the only thing that rotates. */}
              <motion.div
                aria-hidden
                className="absolute inset-0 rounded-full"
                animate={isPlaying ? { rotate: 360 } : {}}
                transition={{ duration: 6, repeat: isPlaying ? Infinity : 0, ease: "linear" }}
                style={{
                  background:
                    "repeating-radial-gradient(circle, #17171c 0px, #17171c 3px, #26262e 3px, #26262e 6px)",
                }}
              />

              {/* Label — stays upright regardless of the ring's rotation. */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTrack.id}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  >
                    <TrackLabel track={currentTrack} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentTrack.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mt-5 flex items-center justify-center gap-2">
                <p className="text-center font-body text-sm font-bold text-white">{currentTrack.title}</p>
                <EqualizerBars animate={isPlaying} />
              </div>
              <p className="text-center font-body text-xs text-white/50">{currentTrack.artist}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-4 flex items-center gap-2">
            <span className="w-8 flex-shrink-0 text-right font-body text-[10px] tabular-nums text-white/50">
              {formatTime(currentTime)}
            </span>
            <div className="has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rose has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[#2b2b33] relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-rose transition-[width]"
                style={{ width: `${progressPercent}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(e) => seek(Number(e.target.value))}
                disabled={!musicEnabled || duration === 0}
                aria-label="Seek"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
            </div>
            <span className="w-8 flex-shrink-0 font-body text-[10px] tabular-nums text-white/50">
              {formatTime(duration)}
            </span>
          </div>

          {audioError && (
            <p role="alert" className="mt-2 text-center font-body text-xs text-rose">
              Music couldn&apos;t be loaded.
            </p>
          )}

          <div className="mt-4 flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={goToPrevious}
              disabled={!musicEnabled}
              aria-label="Previous song"
              className="text-white/70 transition hover:text-white disabled:pointer-events-none disabled:opacity-30"
            >
              <SkipBackIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              disabled={!musicEnabled}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#2b2b33] transition active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={goToNext}
              disabled={!musicEnabled}
              aria-label="Next song"
              className="text-white/70 transition hover:text-white disabled:pointer-events-none disabled:opacity-30"
            >
              <SkipForwardIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-full bg-white/10 px-4 py-2.5">
            <span className="font-body text-xs font-semibold text-white/80">Music On</span>
            <button
              type="button"
              role="switch"
              aria-checked={musicEnabled}
              aria-label="Toggle music"
              onClick={toggleMusicEnabled}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                musicEnabled ? "bg-rose" : "bg-white/25"
              }`}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="h-5 w-5 rounded-full bg-white shadow"
                style={{ marginLeft: musicEnabled ? "calc(100% - 1.25rem)" : "0.125rem" }}
              />
            </button>
          </div>
        </motion.div>

        <div className="relative mt-6 flex justify-center">
          <p className="relative max-w-[240px] rounded-[1.5rem] bg-white px-5 py-3 text-center font-hand text-lg text-ink shadow-[var(--card-shadow)]">
            {wedding.music.speechBubble}
            <span
              aria-hidden
              className="absolute left-1/2 -bottom-2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white"
            />
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="relative -mx-5 mt-6 aspect-[4/3] overflow-hidden"
        >
          <Image
            src={wedding.music.bottomImage}
            alt="Athul and Catherine sitting under a temple archway, smiling at each other"
            fill
            sizes="(max-width: 640px) 100vw, 500px"
            loading="lazy"
            className="object-cover object-center"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[var(--sky-bottom)] to-transparent"
          />
        </motion.div>
      </div>
    </section>
  );
}
