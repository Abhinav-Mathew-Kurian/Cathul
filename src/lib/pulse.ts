// Music-reactive effects (beating hearts, string-light flares, the widget's
// beat ring) run as compositor animations instead of per-frame JS.
//
// Every track already has an offline pulse map (scripts/analyze-audio.mjs):
// bass energy at 30fps plus beat timestamps. Since the whole song is known up
// front, each effect's curve can be *compiled* ahead of time rather than
// computed live:
//
//   1. Replay the same smoothing the live loop used (fast attack, slow
//      release) at 60Hz over the whole track, plus each beat's decay.
//   2. Evaluate each effect's formula on those samples.
//   3. Simplify every 16s window with Ramer–Douglas–Peucker, keeping only
//      the keyframes needed to stay within EPSILON of the exact curve.
//   4. Play the window with WAAPI (transform/opacity → compositor), locked to
//      audio.currentTime; PulseClock re-arms at each window edge, on seek,
//      pause, buffering and any drift.
//
// The main thread then does nothing per frame while a song plays.

export type PulseMap = { fps: number; level: Float32Array; beats: Float32Array };

export type PulseChannel = "heart" | "flareEven" | "flareOdd" | "ring";

type Frame = { opacity?: number; scale: number };

const SIM_HZ = 60;
const WINDOW_S = 16;
// Max deviation from the exact curve, in scale/opacity units (0.6%).
const EPSILON = 0.006;
const SETTLE_MS = 800;

// The effect formulas — identical to the ones the per-frame version used.
// `level` is smoothed bass energy (0–1), `beat` is 1 on a beat decaying to 0,
// `count` is how many beats have passed (neighbouring flares alternate on it).
const CHANNELS: Record<PulseChannel, (level: number, beat: number, count: number) => Frame> = {
  heart: (level, beat) => ({ scale: 1 + beat * 0.3 + level * 0.06 }),
  flareEven: (level, beat, count) => ({
    opacity: Math.min(1, level * 0.35 + beat * (count % 2 === 0 ? 0.75 : 0.15)),
    scale: 0.8 + level * 0.5 + beat * 0.35,
  }),
  flareOdd: (level, beat, count) => ({
    opacity: Math.min(1, level * 0.35 + beat * ((count + 1) % 2 === 0 ? 0.75 : 0.15)),
    scale: 0.8 + level * 0.5 + beat * 0.35,
  }),
  ring: (_level, beat) => ({ opacity: beat * 0.55, scale: 1.55 - 0.55 * beat }),
};

function toKeyframe(frame: Frame): Keyframe {
  const keyframe: Keyframe = { transform: `scale(${frame.scale.toFixed(4)})` };
  if (frame.opacity !== undefined) keyframe.opacity = Number(frame.opacity.toFixed(4));
  return keyframe;
}

/** The value an effect sits at with no music — also its element's static style. */
export function restStyle(channel: PulseChannel): Keyframe {
  return toKeyframe(CHANNELS[channel](0, 0, 0));
}

export type CompiledPulse = {
  duration: number;
  /** Smoothed bass level at `time` seconds — for effects that only need it coarsely. */
  levelAt: (time: number) => number;
  /** Keyframes for one channel over window `index` (cached). */
  window: (channel: PulseChannel, index: number) => { keyframes: Keyframe[]; durationMs: number };
};

export function compilePulse(map: PulseMap): CompiledPulse {
  const duration = map.level.length / map.fps;
  const n = Math.ceil(duration * SIM_HZ) + 1;
  const level = new Float32Array(n);
  const beat = new Float32Array(n);
  const count = new Uint16Array(n);

  let smoothed = 0;
  let b = -1;
  for (let i = 0; i < n; i++) {
    const t = i / SIM_HZ;
    const f = t * map.fps;
    const j = Math.floor(f);
    const a = map.level[j] ?? 0;
    const target = a + ((map.level[j + 1] ?? a) - a) * (f - j);
    smoothed += (target - smoothed) * (target > smoothed ? 0.45 : 0.08);
    level[i] = smoothed;
    while (b + 1 < map.beats.length && map.beats[b + 1] <= t) b++;
    beat[i] = b < 0 ? 0 : Math.exp(-(t - map.beats[b]) / 0.13);
    count[i] = b + 1;
  }

  const cache = new Map<string, { keyframes: Keyframe[]; durationMs: number }>();

  function window(channel: PulseChannel, index: number) {
    const key = `${channel}:${index}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const start = index * WINDOW_S * SIM_HZ;
    const end = Math.min(n - 1, (index + 1) * WINDOW_S * SIM_HZ);
    const fn = CHANNELS[channel];
    const frames: Frame[] = [];
    for (let i = start; i <= end; i++) frames.push(fn(level[i], beat[i], count[i]));

    const keep = simplify(frames);
    const span = end - start || 1;
    const keyframes = keep.map((k) => ({ ...toKeyframe(frames[k]), offset: k / span }));
    const result = { keyframes, durationMs: (span / SIM_HZ) * 1000 };
    cache.set(key, result);
    return result;
  }

  return {
    duration,
    levelAt: (time) => level[Math.max(0, Math.min(n - 1, Math.round(time * SIM_HZ)))],
    window,
  };
}

// Ramer–Douglas–Peucker over evenly spaced samples, measuring each point's
// vertical distance (in every channel) from the straight line between the
// kept neighbours — exactly the error linear keyframe interpolation would
// introduce. Iterative, so a long window can't blow the stack.
function simplify(frames: Frame[]): number[] {
  const last = frames.length - 1;
  if (last < 2) return frames.map((_, i) => i);
  const keep = new Uint8Array(frames.length);
  keep[0] = keep[last] = 1;
  const stack: [number, number][] = [[0, last]];

  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let worst = -1;
    let worstErr = EPSILON;
    for (let i = lo + 1; i < hi; i++) {
      const t = (i - lo) / (hi - lo);
      const a = frames[lo];
      const z = frames[hi];
      let err = Math.abs(frames[i].scale - (a.scale + (z.scale - a.scale) * t));
      if (a.opacity !== undefined && z.opacity !== undefined && frames[i].opacity !== undefined) {
        err = Math.max(err, Math.abs(frames[i].opacity! - (a.opacity + (z.opacity - a.opacity) * t)));
      }
      if (err > worstErr) {
        worstErr = err;
        worst = i;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([lo, worst], [worst, hi]);
    }
  }

  const out: number[] = [];
  keep.forEach((k, i) => k && out.push(i));
  return out;
}

type Subscriber = { channel: PulseChannel; animation: Animation | null };

/**
 * Keeps every subscribed element's compositor animation locked to the audio
 * element's clock. Elements subscribe while on screen and unsubscribe when
 * they leave, so offscreen effects cost nothing at all.
 */
export class PulseClock {
  private audio: HTMLAudioElement | null = null;
  private pulse: CompiledPulse | null = null;
  private subscribers = new Map<HTMLElement, Subscriber>();
  private running = false;
  private windowIndex = -1;
  // Document-timeline time (ms) at which the current window's offset 0 plays.
  private windowStart = 0;
  private drifting = false;
  private timer = 0;
  private readonly enabled: boolean;

  constructor() {
    this.enabled =
      typeof window !== "undefined" &&
      typeof Element.prototype.animate === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  attach(audio: HTMLAudioElement) {
    this.audio = audio;
    const start = () => this.setRunning(true);
    const stop = () => this.setRunning(false);
    const resync = () => this.running && this.arm();
    const checkDrift = () => this.checkDrift();
    const events: [string, () => void][] = [
      ["playing", start],
      ["pause", stop],
      ["waiting", stop],
      ["ended", stop],
      ["emptied", stop],
      ["seeked", resync],
      ["timeupdate", checkDrift],
    ];
    for (const [name, fn] of events) audio.addEventListener(name, fn);
    document.addEventListener("visibilitychange", resync);
    return () => {
      for (const [name, fn] of events) audio.removeEventListener(name, fn);
      document.removeEventListener("visibilitychange", resync);
      this.setRunning(false);
      this.audio = null;
    };
  }

  setPulse(pulse: CompiledPulse | null) {
    this.pulse = pulse;
    if (this.running) this.arm();
    else this.settleAll();
  }

  get levelAt() {
    return this.pulse && this.running ? this.pulse.levelAt : null;
  }

  subscribe(el: HTMLElement, channel: PulseChannel) {
    const sub: Subscriber = { channel, animation: null };
    this.subscribers.set(el, sub);
    if (this.running && this.pulse && this.windowIndex >= 0) this.start(el, sub);
    return () => {
      sub.animation?.cancel();
      this.subscribers.delete(el);
    };
  }

  private setRunning(running: boolean) {
    this.running = running && this.enabled;
    if (this.running) this.arm();
    else {
      window.clearTimeout(this.timer);
      this.windowIndex = -1;
      this.settleAll();
    }
  }

  // (Re)start every subscriber on the window containing the audio's current
  // time, and schedule the hand-off to the next window.
  private arm() {
    window.clearTimeout(this.timer);
    const { audio, pulse } = this;
    if (!audio || !pulse || !this.running) return;
    const time = audio.currentTime;
    this.windowIndex = Math.floor(time / WINDOW_S);
    this.windowStart = performance.now() - (time - this.windowIndex * WINDOW_S) * 1000;
    this.drifting = false;
    for (const [el, sub] of this.subscribers) this.start(el, sub);
    const untilNext = ((this.windowIndex + 1) * WINDOW_S - time) * 1000;
    if (time < pulse.duration) this.timer = window.setTimeout(() => this.arm(), Math.max(16, untilNext));
  }

  // Anchored by startTime on the document timeline, not by currentTime: a
  // new animation only starts on the next frame, and setting currentTime
  // would carry that start-up delay (~100ms on a slow phone) as permanent
  // lag. Every subscriber shares the same anchor, so they stay in lockstep.
  private start(el: HTMLElement, sub: Subscriber) {
    if (!this.pulse) return;
    const { keyframes, durationMs } = this.pulse.window(sub.channel, this.windowIndex);
    sub.animation?.cancel();
    sub.animation = el.animate(keyframes, { duration: durationMs, fill: "both" });
    sub.animation.startTime = this.windowStart;
  }

  // timeupdate fires ~4×/s. If the audio has drifted from the anchor by more
  // than a few frames on two checks in a row (one noisy reading isn't
  // enough), re-anchor everything.
  private checkDrift() {
    if (!this.running || !this.audio || this.windowIndex < 0) return;
    const expected = (this.audio.currentTime - this.windowIndex * WINDOW_S) * 1000;
    const drifted = Math.abs(performance.now() - this.windowStart - expected) > 50;
    if (drifted && this.drifting) this.arm();
    this.drifting = drifted;
  }

  // Paused/stopped: ease each effect from wherever it is back to rest, as the
  // live version's level/beat did (0.8s ease-out).
  private settleAll() {
    for (const [el, sub] of this.subscribers) {
      const { animation } = sub;
      if (!animation) continue;
      const style = getComputedStyle(el);
      const from: Keyframe = { transform: style.transform === "none" ? "scale(1)" : style.transform };
      const rest = restStyle(sub.channel);
      if (rest.opacity !== undefined) from.opacity = style.opacity;
      animation.cancel();
      sub.animation = null;
      el.animate([from, rest], { duration: SETTLE_MS, easing: "ease-out" });
    }
  }
}
