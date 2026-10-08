"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { animate, useMotionValue, type MotionValue } from "motion/react";
import { wedding, type Track } from "@/content/wedding";
import { compilePulse, PulseClock, type PulseChannel, type PulseMap } from "@/lib/pulse";
import { track } from "@/lib/track";

const playlist: Track[] = wedding.music.playlist;

type MusicContextValue = {
  playlist: Track[];
  trackIndex: number;
  currentTrack: Track;
  isPlaying: boolean;
  musicEnabled: boolean;
  audioError: boolean;
  startPlayback: () => void;
  togglePlay: () => void;
  goToNext: () => void;
  goToPrevious: () => void;
  toggleMusicEnabled: () => void;
};

type MusicProgressValue = {
  currentTime: number;
  duration: number;
  seek: (value: number) => void;
};

// Split in two so a `timeupdate` tick (multiple times a second while playing)
// only re-renders whoever actually reads currentTime/duration — the progress
// bar in Music.tsx. Before this split, the floating widget subscribed to the
// same object and re-rendered on every tick too, which kept restarting its
// pulsing-ring animation from scratch and looked like a flicker.
const MusicContext = createContext<MusicContextValue | null>(null);
const MusicProgressContext = createContext<MusicProgressValue | null>(null);

type MusicPulseValue = {
  /** Smoothed bass energy of what's playing right now, 0–1 (0 while paused).
   * Updated a few times a second — for effects that react to it coarsely. */
  level: MotionValue<number>;
  /** Drives the beat-synced effects as compositor animations — see lib/pulse.ts. */
  clock: PulseClock;
};

// A third context whose value never changes identity, so nothing re-renders
// from it: the pulse reaches the DOM through compositor animations and a
// motion value instead.
const MusicPulseContext = createContext<MusicPulseValue | null>(null);

export function useMusicPulse() {
  const ctx = useContext(MusicPulseContext);
  if (!ctx) throw new Error("useMusicPulse must be used within a MusicProvider");
  return ctx;
}

/** Plays `channel`'s beat-synced animation on the element while it's mounted. */
export function usePulse(ref: RefObject<HTMLElement | null>, channel: PulseChannel) {
  const { clock } = useMusicPulse();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return clock.subscribe(el, channel);
  }, [clock, ref, channel]);
}

// Must match scripts/analyze-audio.mjs.
const PULSE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function decodePulse(raw: { fps: number; level: string; beats: number[] }): PulseMap {
  const scale = PULSE_ALPHABET.length - 1;
  return {
    fps: raw.fps,
    level: Float32Array.from(raw.level, (c) => Math.max(0, PULSE_ALPHABET.indexOf(c)) / scale),
    beats: Float32Array.from(raw.beats, (frame) => frame / raw.fps),
  };
}

// "/audio/song-1-jhol.mp3" → "/audio/pulse/song-1-jhol.json"
function pulseUrl(src: string) {
  return src.replace(/\/([^/]+)\.mp3$/, "/pulse/$1.json");
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within a MusicProvider");
  return ctx;
}

export function useMusicProgress() {
  const ctx = useContext(MusicProgressContext);
  if (!ctx) throw new Error("useMusicProgress must be used within a MusicProvider");
  return ctx;
}

// Hosts the single, page-wide <audio> element and all playback state, so the
// in-section player (Music.tsx) and the floating corner widget control the
// exact same audio instead of each owning a separate one.
export function MusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isPlayingRef = useRef(false);
  const musicEnabledRef = useRef(true);
  const hasAutoplayedRef = useRef(false);
  const pickedTrackRef = useRef(false);

  // Starts at 0 for a deterministic server/first-render match — randomizing
  // here (e.g. in an effect) would either mismatch server vs. client HTML or
  // fire a second render for no reason. Instead, startPlayback() below picks
  // the random track itself, synchronously, inside the real click handler.
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  // Set by startPlayback right before it changes trackIndex itself, so the
  // effect below doesn't redundantly reload/replay a track that's already
  // mid-play — that race would otherwise cut the very first note short.
  const skipNextLoadRef = useRef(false);

  const currentTrack = playlist[trackIndex];

  const level = useMotionValue(0);
  const [clock] = useState(() => new PulseClock());

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) return clock.attach(audio);
  }, [clock]);

  // Each track's pulse map is precomputed offline (scripts/analyze-audio.mjs)
  // and compiled into compositor keyframes here (lib/pulse.ts). The live
  // audio is never routed through Web Audio, so a suspended AudioContext
  // can't silence playback.
  useEffect(() => {
    let cancelled = false;
    clock.setPulse(null);
    fetch(pulseUrl(currentTrack.src))
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (!cancelled && raw) clock.setPulse(compilePulse(decodePulse(raw)));
      })
      .catch(() => {
        // No map for this track: the site simply doesn't pulse.
      });
    return () => {
      cancelled = true;
    };
  }, [clock, currentTrack.src]);

  // `level` only feeds FallingPetals' coarse speed steps, so a few updates a
  // second is plenty — no per-frame loop.
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isPlaying || reduceMotion) {
      const a = animate(level, 0, { duration: 0.8, ease: "easeOut" });
      return () => a.stop();
    }
    const id = window.setInterval(() => {
      const audio = audioRef.current;
      const levelAt = clock.levelAt;
      if (audio && levelAt) level.set(levelAt(audio.currentTime));
    }, 150);
    return () => window.clearInterval(id);
  }, [isPlaying, level, clock]);

  const pulseValue = useMemo<MusicPulseValue>(() => ({ level, clock }), [level, clock]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  const goToNext = useCallback(() => {
    setTrackIndex((i) => (i + 1) % playlist.length);
  }, []);

  const goToPrevious = useCallback(() => {
    setTrackIndex((i) => (i - 1 + playlist.length) % playlist.length);
  }, []);

  // Audio element events — attached once. `goToNext` is stable (only ever
  // calls setTrackIndex with a functional updater), so this never goes stale.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => goToNext();
    const onError = () => setAudioError(true);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [goToNext]);

  // Track changed: reload the new source, reset the timeline, and keep
  // playing only if we already were.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);

    if (skipNextLoadRef.current) {
      // startPlayback already set the src, loaded it, and called play()
      // directly inside the click handler — redoing it here would restart
      // (and briefly cut) the track that's already playing.
      skipNextLoadRef.current = false;
      return;
    }

    audio.load();
    if (isPlayingRef.current) {
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [trackIndex]);

  // "Auto on": InvitationGate calls this directly, synchronously, from its
  // own "Tap to Open" click handler — a plain click is the one gesture type
  // every browser (including iOS Safari, which is fussier than desktop
  // Chrome about which events count) reliably treats as permission to play
  // audio. This never *tries* to bypass the policy; it rides a real gesture.
  //
  // Also picks a random track to open on — set directly on the element and
  // played immediately (not via setTrackIndex first) so the very same click
  // both starts audio *and* lands on a random song, with no gap where an
  // async state update could cost the browser's "recent user gesture" grace.
  //
  // hasAutoplayedRef only flips once play() actually *succeeds* — a slower
  // network (e.g. over a tunnel) or a momentary block can fail the very
  // first attempt, and since the gate only opens once, that used to mean
  // giving up on autoplay forever. Now a failed attempt stays retryable, and
  // the effect below retries it on the next tap anywhere on the page.
  const startPlayback = useCallback(() => {
    if (hasAutoplayedRef.current || !musicEnabledRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (!pickedTrackRef.current) {
      pickedTrackRef.current = true;
      const randomIndex = Math.floor(Math.random() * playlist.length);
      skipNextLoadRef.current = true;
      audio.src = playlist[randomIndex].src;
      audio.load();
      setTrackIndex(randomIndex);
    }

    audio
      .play()
      .then(() => {
        hasAutoplayedRef.current = true;
        setIsPlaying(true);
      })
      .catch(() => {
        // Still blocked/loading — the retry effect below will try again.
      });
  }, []);

  // Safety net: if the gate-click attempt didn't actually start playback,
  // retry on every subsequent tap anywhere until it does, then stop.
  useEffect(() => {
    function retry() {
      if (hasAutoplayedRef.current) {
        window.removeEventListener("pointerdown", retry);
        return;
      }
      startPlayback();
    }
    window.addEventListener("pointerdown", retry);
    return () => window.removeEventListener("pointerdown", retry);
  }, [startPlayback]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !musicEnabledRef.current) return;
    if (isPlayingRef.current) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, []);

  const toggleMusicEnabled = useCallback(() => {
    const audio = audioRef.current;
    if (musicEnabledRef.current) {
      track("action:music-off");
      audio?.pause();
      setIsPlaying(false);
      setMusicEnabled(false);
    } else {
      setMusicEnabled(true);
    }
  }, []);

  const seek = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio || !musicEnabledRef.current) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }, []);

  const musicValue = useMemo<MusicContextValue>(
    () => ({
      playlist,
      trackIndex,
      currentTrack,
      isPlaying,
      musicEnabled,
      audioError,
      startPlayback,
      togglePlay,
      goToNext,
      goToPrevious,
      toggleMusicEnabled,
    }),
    [
      trackIndex,
      currentTrack,
      isPlaying,
      musicEnabled,
      audioError,
      startPlayback,
      togglePlay,
      goToNext,
      goToPrevious,
      toggleMusicEnabled,
    ]
  );

  const progressValue = useMemo<MusicProgressValue>(
    () => ({ currentTime, duration, seek }),
    [currentTime, duration, seek]
  );

  return (
    <MusicContext.Provider value={musicValue}>
      <MusicProgressContext.Provider value={progressValue}>
        <MusicPulseContext.Provider value={pulseValue}>
          <audio ref={audioRef} src={currentTrack.src} preload="none" />
          {children}
        </MusicPulseContext.Provider>
      </MusicProgressContext.Provider>
    </MusicContext.Provider>
  );
}
