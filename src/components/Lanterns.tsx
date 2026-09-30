"use client";

import { useEffect, useRef, useState } from "react";
import { wedding } from "@/content/wedding";
import { burst, haptic } from "@/lib/burst";

// Paper lanterns drifting up out of the footer artwork's sky, from behind the
// couple. Tapping one makes it flare and whoosh upward, and a blessing
// floats up where it was.

// Same deterministic pseudo-randomness as FallingPetals — pure render, no Math.random.
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Hand-placed against the artwork: x/y (% of the footer) where each lantern
// first appears, and a base scale so some read as farther away than others.
const SPOTS = [
  { x: 20, y: 60, scale: 0.85 },
  { x: 33, y: 50, scale: 1 },
  { x: 52, y: 44, scale: 0.75 },
  { x: 74, y: 50, scale: 0.95 },
  { x: 86, y: 62, scale: 0.8 },
];

const LANTERNS = SPOTS.map((spot, i) => ({
  ...spot,
  sway: 8 + seeded(i, 1) * 10,
  turns: 1 + Math.round(seeded(i, 2)),
  duration: (13 + seeded(i, 3) * 6) * 1000,
  phase: seeded(i, 4),
  flickerDelay: `${(-seeded(i, 5) * 2.4).toFixed(2)}s`,
}));

type Lantern = (typeof LANTERNS)[number];

const GOLD = ["#ffcf7a", "#ffe3a3", "#f29a4a", "#fff4c9"];
const RELEASE_RATE = 3;
const RELEASE_MS = 1200;
const BLESSING_MS = 3400;

// Concrete px values in every keyframe (no CSS variables) so the browser runs
// them on the compositor. `rise` is measured from the footer when animation starts.
function buildKeyframes(lantern: Lantern, rise: number): Keyframe[] {
  return Array.from({ length: 9 }, (_, step) => {
    const t = step / 8;
    const wave = Math.sin(t * Math.PI * 2 * lantern.turns);
    const x = wave * lantern.sway;
    const scale = lantern.scale * (1 - 0.35 * t);
    const opacity = t === 0 || t === 1 ? 0 : t > 0.8 ? 0.7 : 1;
    return {
      offset: t,
      opacity,
      transform: `translate3d(${x.toFixed(1)}px, ${(-rise * t).toFixed(1)}px, 0) rotate(${(wave * 5).toFixed(1)}deg) scale(${scale.toFixed(3)})`,
    };
  });
}

type Blessing = { id: number; text: string; y: number };

export function Lanterns() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationsRef = useRef<Animation[]>([]);
  const nextBlessing = useRef(0);
  const [blessings, setBlessings] = useState<Blessing[]>([]);

  // Only animate while the footer is on (or near) screen, like FallingPetals.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof container.animate !== "function") return;
    const buttons = Array.from(container.querySelectorAll<HTMLElement>(".lantern"));

    // Reduced motion: lanterns hang still in the sky, still tappable.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      buttons.forEach((el, i) => {
        el.style.opacity = "1";
        el.style.transform = `translateY(${(-container.clientHeight * 0.18 * (1 + LANTERNS[i].phase)).toFixed(0)}px) scale(${LANTERNS[i].scale})`;
      });
      return;
    }

    const start = () => {
      if (animationsRef.current.length) return;
      container.dataset.live = "";
      const rise = container.clientHeight * 0.52;
      const now = performance.now();
      animationsRef.current = buttons.map((el, i) => {
        const lantern = LANTERNS[i];
        const offset = (lantern.phase * lantern.duration + now) % lantern.duration;
        return el.animate(buildKeyframes(lantern, rise), {
          duration: lantern.duration,
          delay: -offset,
          iterations: Infinity,
          easing: "linear",
        });
      });
    };
    const stop = () => {
      delete container.dataset.live;
      for (const animation of animationsRef.current) animation.cancel();
      animationsRef.current = [];
    };
    // The rise is in px, so a resize (e.g. rotating the phone) rebuilds it.
    const restart = () => {
      if (!animationsRef.current.length) return;
      stop();
      start();
    };

    const observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), {
      rootMargin: "120px 0px",
    });
    observer.observe(container);
    window.addEventListener("resize", restart);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", restart);
      stop();
    };
  }, []);

  function release(index: number, el: HTMLButtonElement) {
    const container = containerRef.current;
    if (!container) return;
    const box = el.getBoundingClientRect();
    const frame = container.getBoundingClientRect();
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;

    burst({ x: centerX, y: centerY, count: 14, speed: 300, shapes: ["heart"], colors: GOLD, size: [5, 9], life: 1.6 });
    haptic(10);

    el.querySelector(".lantern-halo")?.animate(
      [
        { transform: "scale(1)", opacity: 0.7 },
        { transform: "scale(2.4)", opacity: 1 },
        { transform: "scale(1)", opacity: 0.7 },
      ],
      { duration: 900, easing: "ease-out" }
    );

    const animation = animationsRef.current[index];
    if (animation) {
      animation.updatePlaybackRate(RELEASE_RATE);
      window.setTimeout(() => animation.updatePlaybackRate(1), RELEASE_MS);
    }

    const list = wedding.lanterns.blessings;
    const id = nextBlessing.current++;
    // Centered across the card (so it never runs off an edge), just above the
    // lantern — but never over the hint line at the top.
    const blessing = { id, text: list[id % list.length], y: Math.max(centerY - frame.top - 64, 44) };
    setBlessings((current) => [...current.slice(-2), blessing]);
    window.setTimeout(() => setBlessings((current) => current.filter((b) => b.id !== id)), BLESSING_MS);
  }

  return (
    <div ref={containerRef} className="lanterns absolute inset-0 overflow-hidden">
      {LANTERNS.map((lantern, i) => (
        <button
          key={i}
          type="button"
          aria-label="Send a lantern up with your blessings"
          onClick={(e) => release(i, e.currentTarget)}
          className="lantern absolute -ml-5 -mt-6 flex h-12 w-10 cursor-pointer touch-manipulation items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bulb-glow)]"
          style={{ left: `${lantern.x}%`, top: `${lantern.y}%` }}
        >
          <span className="lantern-halo" style={{ animationDelay: lantern.flickerDelay }} />
          <span className="lantern-body" />
        </button>
      ))}

      {blessings.map((blessing) => (
        <p
          key={blessing.id}
          role="status"
          className="blessing pointer-events-none absolute left-1/2 z-10 w-max max-w-[80%] rounded-full bg-cream/90 px-3.5 py-1.5 text-center font-hand text-lg leading-tight text-ink shadow-[0_6px_20px_-6px_rgba(242,154,74,0.7)]"
          style={{ top: blessing.y }}
        >
          {blessing.text}
        </p>
      ))}
    </div>
  );
}
