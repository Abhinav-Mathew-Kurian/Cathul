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
} from "react";
import { animate, useMotionValue, type MotionValue } from "motion/react";
import { wedding, type Track } from "@/content/wedding";

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
  /** Smoothed bass energy of what's playing right now, 0–1 (0 while paused). */
  level: MotionValue<number>;
  /** 1 on each beat, decaying to 0 within ~0.4s — a ready-made "thump". */
  beat: MotionValue<number>;
  /** How many beats have passed — lets neighbours alternate on the beat. */
  beatCount: MotionValue<number>;
};

// A third context, holding only motion values: these change every frame, but
// motion writes them straight to the DOM, so subscribers never re-render.
const MusicPulseContext = createContext<MusicPulseValue | null>(null);

export function useMusicPulse() {
  const ctx = useContext(MusicPulseContext);
  if (!ctx) throw new Error("useMusicPulse must be used within a MusicProvider");
  return ctx;
}

// Must match scripts/analyze-audio.mjs.
const PULSE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

type PulseMap = { fps: number; level: Float32Array; beats: Float32Array };

function decodePulse(raw: { fps: number; level: string; beats: number[] }): PulseMap {
  const scale = PULSE_ALPHABET.length - 1;
  return {
    fps: raw.fps,
    level: Float32Array.from(raw.level, (c) => Math.max(0, PULSE_ALPHABET.indexOf(c)) / scale),
    beats: Float32Array.from(raw.beats, (frame) => frame / raw.fps),
  };
}

/** Index of the last beat at or before `time`, or -1 — binary search, so seeking just works. */
function lastBeatIndex(beats: Float32Array, time: number) {
  let lo = 0;
  let hi = beats.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
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
  const beat = useMotionValue(0);
  const beatCount = useMotionValue(0);
  const pulseMapRef = useRef<PulseMap | null>(null);

  // Each track's pulse map is precomputed offline (scripts/analyze-audio.mjs)
  // and read against audio.currentTime. The live audio is never routed
  // through Web Audio, so a suspended AudioContext can't silence playback.
  useEffect(() => {
    let cancelled = false;
    pulseMapRef.current = null;
    fetch(pulseUrl(currentTrack.src))
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (!cancelled && raw) pulseMapRef.current = decodePulse(raw);
      })
      .catch(() => {
        // No map for this track: the site simply doesn't pulse.
      });
    return () => {
      cancelled = true;
    };
  }, [currentTrack.src]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isPlaying || reduceMotion) {
      const easeOut = { duration: 0.8, ease: "easeOut" } as const;
      const a = animate(level, 0, easeOut);
      const b = animate(beat, 0, easeOut);
      return () => {
        a.stop();
        b.stop();
      };
    }

    let raf = 0;
    let smoothed = level.get();
    const tick = () => {
      const audio = audioRef.current;
      const map = pulseMapRef.current;
      if (audio && map) {
        const t = audio.currentTime;
        const f = t * map.fps;
        const i = Math.floor(f);
        const a = map.level[i] ?? 0;
        const target = a + ((map.level[i + 1] ?? a) - a) * (f - i);
        // Fast attack, slow release — reads as "breathing", not flicker.
        smoothed += (target - smoothed) * (target > smoothed ? 0.45 : 0.08);
        level.set(smoothed);

        const b = lastBeatIndex(map.beats, t);
        beat.set(b < 0 ? 0 : Math.exp(-(t - map.beats[b]) / 0.13));
        if (b + 1 !== beatCount.get()) beatCount.set(b + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, level, beat, beatCount]);

  const pulseValue = useMemo<MusicPulseValue>(() => ({ level, beat, beatCount }), [level, beat, beatCount]);

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
