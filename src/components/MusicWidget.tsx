"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMusic } from "./MusicProvider";

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

function MusicNoteIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z" />
    </svg>
  );
}

// A small persistent control that floats above every section, so a visitor
// who has already scrolled past the Music section can still pause, skip, or
// resume without scrolling back up to it.
export function MusicWidget() {
  const [open, setOpen] = useState(false);
  const { currentTrack, isPlaying, musicEnabled, togglePlay, goToNext, goToPrevious } = useMusic();

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-14 right-0 w-52 rounded-2xl bg-[#2b2b33] p-3 shadow-[var(--card-shadow)]"
          >
            <p className="truncate px-1 font-body text-xs font-bold text-white">{currentTrack.title}</p>
            <p className="truncate px-1 font-body text-[11px] text-white/50">{currentTrack.artist}</p>
            <div className="mt-2 flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={goToPrevious}
                disabled={!musicEnabled}
                aria-label="Previous song"
                className="text-white/70 transition hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                <SkipBackIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                disabled={!musicEnabled}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2b2b33] transition active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              >
                {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={goToNext}
                disabled={!musicEnabled}
                aria-label="Next song"
                className="text-white/70 transition hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                <SkipForwardIcon className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close music controls" : "Open music controls"}
        aria-expanded={open}
        whileTap={{ scale: 0.92 }}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-rose text-white shadow-[var(--card-shadow)]"
      >
        {isPlaying && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-rose"
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <MusicNoteIcon className="relative h-5 w-5" />
      </motion.button>
    </div>
  );
}
