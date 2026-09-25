// Precomputes a small "pulse map" for every track in public/audio — a bass
// energy envelope plus beat timestamps — so the site can move to the music
// by reading audio.currentTime against this map, instead of routing the live
// <audio> element through a Web Audio analyser (which silences playback
// whenever iOS suspends the AudioContext).
//
// Re-run after adding or swapping a song:  node scripts/analyze-audio.mjs

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MPEGDecoder } from "mpg123-decoder";

const AUDIO_DIR = path.resolve("public/audio");
const OUT_DIR = path.join(AUDIO_DIR, "pulse");
const FPS = 30;
// 64 levels, one printable char each — ~7KB per 4-minute song.
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function percentile(values, p) {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 1;
}

// Two cascaded one-pole low-passes — enough to isolate kick/bass energy.
function lowPass(samples, sampleRate, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  const out = new Float32Array(samples.length);
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    y1 += a * (samples[i] - y1);
    y2 += a * (y1 - y2);
    out[i] = y2;
  }
  return out;
}

function frameRms(samples, frameSize) {
  const frames = Math.floor(samples.length / frameSize);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * frameSize; i < (f + 1) * frameSize; i++) sum += samples[i] * samples[i];
    out[f] = Math.sqrt(sum / frameSize);
  }
  return out;
}

function analyze(channelData, sampleRate) {
  const length = channelData[0].length;
  const mono = new Float32Array(length);
  for (const channel of channelData) {
    for (let i = 0; i < length; i++) mono[i] += channel[i] / channelData.length;
  }

  const frameSize = Math.round(sampleRate / FPS);
  const bass = frameRms(lowPass(mono, sampleRate, 140), frameSize);
  const full = frameRms(mono, frameSize);

  const bassRef = percentile(bass, 0.95);
  const fullRef = percentile(full, 0.95);
  const energy = bass.map((b, i) => Math.min(1, 0.7 * (b / bassRef) + 0.3 * (full[i] / fullRef)));

  // Onset strength: how far energy jumps above its own recent average.
  const onset = new Float32Array(energy.length);
  const WINDOW = Math.round(FPS * 0.4);
  for (let i = 0; i < energy.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - WINDOW); j < i; j++) {
      sum += energy[j];
      n++;
    }
    onset[i] = Math.max(0, energy[i] - (n ? sum / n : 0));
  }

  const onsetRef = percentile(onset, 0.97);
  const beats = [];
  const MIN_GAP = Math.round(FPS * 0.26);
  for (let i = 3; i < onset.length - 3; i++) {
    if (onset[i] < onsetRef * 0.3) continue;
    let isPeak = true;
    for (let j = i - 3; j <= i + 3; j++) if (onset[j] > onset[i]) isPeak = false;
    if (!isPeak) continue;
    if (beats.length && i - beats[beats.length - 1] < MIN_GAP) continue;
    beats.push(i);
  }

  const level = Array.from(energy, (e) => ALPHABET[Math.round(e * (ALPHABET.length - 1))]).join("");
  return { fps: FPS, level, beats };
}

const decoder = new MPEGDecoder();
await decoder.ready;
await mkdir(OUT_DIR, { recursive: true });

for (const file of (await readdir(AUDIO_DIR)).filter((f) => f.endsWith(".mp3")).sort()) {
  const { channelData, sampleRate } = decoder.decode(await readFile(path.join(AUDIO_DIR, file)));
  await decoder.reset();
  const pulse = analyze(channelData, sampleRate);
  const outFile = path.join(OUT_DIR, file.replace(/\.mp3$/, ".json"));
  await writeFile(outFile, JSON.stringify(pulse));
  const seconds = pulse.level.length / FPS;
  console.log(
    `${file}: ${seconds.toFixed(0)}s, ${pulse.beats.length} beats (${((pulse.beats.length / seconds) * 60).toFixed(0)}/min)`
  );
}

decoder.free();
