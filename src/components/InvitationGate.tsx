"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Image from "next/image";
import { wedding } from "@/content/wedding";
import { burst, haptic } from "@/lib/burst";
import { HeartIcon, LeafSprig } from "./doodles";
import { useMusic } from "./MusicProvider";

// closed → cracking (the wax seal splits) → opening (the gatefold swings
// apart) → open (the overlay is gone).
type Stage = "closed" | "cracking" | "opening" | "open";

const CRACK_MS = 420;
const DOOR_S = 1.5;
const OPEN_MS = CRACK_MS + DOOR_S * 1000 + 100;
const DOOR_EASE = [0.55, 0, 0.3, 1] as const;

// Defaults to true so anything rendered outside the gate still animates.
const GateRevealedContext = createContext(true);

/** True once the invitation has started opening — the page behind it can start its entrance. */
export function useGateRevealed() {
  return useContext(GateRevealedContext);
}

// A lumpy, hand-poured wax outline: a circle wobbled by a few low harmonics,
// so the edge bulges like real sealing wax instead of reading as a button.
const SEAL_EDGE = (() => {
  const steps = 96;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 53 + 2.4 * Math.sin(t * 5 + 0.6) + 1.5 * Math.sin(t * 9 + 2.1) + 0.9 * Math.sin(t * 14 + 4);
    d += `${i === 0 ? "M" : "L"}${(60 + r * Math.cos(t)).toFixed(2)} ${(60 + r * Math.sin(t)).toFixed(2)}`;
  }
  return `${d}Z`;
})();

const SEAL_DOTS = Array.from({ length: 28 }, (_, i) => {
  const t = (i / 28) * Math.PI * 2;
  return { cx: 60 + 34 * Math.cos(t), cy: 60 + 34 * Math.sin(t) };
});

// The jagged break line the seal splits along — the two polygons share it exactly.
const CRACK = "53% 0, 47% 16%, 55% 33%, 45% 50%, 54% 67%, 47% 84%, 52% 100%";
const CRACK_LEFT = `polygon(0 0, ${CRACK}, 0 100%)`;
const CRACK_RIGHT = `polygon(100% 0, ${CRACK}, 100% 100%)`;

function Monogram({ fill, dy = 0 }: { fill: string; dy?: number }) {
  return (
    <g className="font-display" fontStyle="italic" textAnchor="middle" fill={fill}>
      <text x="45" y={70 + dy} fontSize="30" fontWeight={600}>
        A
      </text>
      <text x="60" y={67 + dy} fontSize="17">
        &amp;
      </text>
      <text x="75" y={70 + dy} fontSize="30" fontWeight={600}>
        C
      </text>
    </g>
  );
}

function SealArt() {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id={`${id}-wax`} cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#dd6f5f" />
          <stop offset="50%" stopColor="#b1443a" />
          <stop offset="100%" stopColor="#7a271f" />
        </radialGradient>
        <radialGradient id={`${id}-press`} cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#a93f35" />
          <stop offset="100%" stopColor="#8a2f27" />
        </radialGradient>
      </defs>
      <path d={SEAL_EDGE} fill={`url(#${id}-wax)`} />
      {/* Pressed-in disc: a dark rim below and a lit rim above read as a stamp's impression. */}
      <circle cx="60" cy="61.5" r="40" fill="none" stroke="rgba(60,10,6,0.4)" strokeWidth="3" />
      <circle cx="60" cy="58.5" r="40" fill="none" stroke="rgba(255,196,180,0.35)" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="39" fill={`url(#${id}-press)`} />
      {SEAL_DOTS.map((dot, i) => (
        <circle key={i} cx={dot.cx.toFixed(2)} cy={dot.cy.toFixed(2)} r="1.1" fill="rgba(255,200,188,0.4)" />
      ))}
      <Monogram fill="rgba(60,10,6,0.55)" dy={1.2} />
      <Monogram fill="rgba(255,205,190,0.45)" dy={-0.9} />
      <Monogram fill="#9c372d" />
      <ellipse cx="40" cy="28" rx="17" ry="6.5" fill="rgba(255,255,255,0.22)" transform="rotate(-30 40 28)" />
    </svg>
  );
}

const TAP_LABEL_CLASS =
  "tracked-caps mt-3 rounded-full bg-cream/90 px-3.5 py-1.5 font-body text-[10px] font-medium text-ink/80 shadow-sm";

function WaxSeal({
  cracked,
  onOpen,
  sealRef,
}: {
  cracked: boolean;
  onOpen: () => void;
  sealRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <motion.div
      className="flex flex-col items-center"
      animate={cracked ? { y: 0 } : { y: [0, -6, 0] }}
      transition={cracked ? { duration: 0.2 } : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.button
        ref={sealRef}
        type="button"
        aria-label="Open your wedding invitation"
        onClick={onOpen}
        disabled={cracked}
        whileHover={cracked ? undefined : { scale: 1.04, rotate: -4 }}
        whileTap={cracked ? undefined : { scale: 0.9 }}
        className="relative h-32 w-32 cursor-pointer select-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
      >
        {/* Warm halo — breathes while waiting, then flashes as the seal breaks. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,214,140,0.85) 0%, rgba(255,207,122,0) 68%)" }}
          animate={
            cracked
              ? { opacity: [0.8, 1, 0], scale: [1, 1.9, 3.2] }
              : { opacity: [0.35, 0.8, 0.35], scale: [0.92, 1.06, 0.92] }
          }
          transition={
            cracked ? { duration: 0.75, ease: "easeOut" } : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
          }
        />
        <span className="absolute inset-0 drop-shadow-[0_8px_14px_rgba(60,10,6,0.38)]">
          {[
            { clip: CRACK_LEFT, dir: -1 },
            { clip: CRACK_RIGHT, dir: 1 },
          ].map((half) => (
            <motion.span
              key={half.dir}
              className="absolute inset-0"
              style={{ clipPath: half.clip }}
              initial={false}
              animate={
                cracked
                  ? {
                      x: [0, half.dir * 3, half.dir * 95],
                      y: [0, -8, 170],
                      rotate: [0, half.dir * 5, half.dir * 55],
                      opacity: [1, 1, 0],
                    }
                  : { x: 0, y: 0, rotate: 0, opacity: 1 }
              }
              transition={{ duration: 0.95, times: [0, 0.16, 1], ease: ["easeOut", "easeIn"] }}
            >
              <SealArt />
            </motion.span>
          ))}
        </span>
      </motion.button>

      <motion.p
        className={TAP_LABEL_CLASS}
        animate={cracked ? { opacity: 0, y: 6 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        Tap to Open
      </motion.p>
    </motion.div>
  );
}

// The invitation card's artwork. Rendered once per gatefold panel (each shows
// its own half), plus once more as an invisible "seal layer" that holds only
// the seal — so the seal sits across the seam in exactly the spot the layout
// reserves for it, and cracks instead of being sliced in two by the doors.
function GateFace({ seal }: { seal?: ReactNode }) {
  const isSealLayer = seal !== undefined;

  return (
    <div className={`absolute inset-0 ${isSealLayer ? "pointer-events-none invisible" : ""}`}>
      {!isSealLayer && (
        <>
          <Image
            src="/images/couple-hero.jpg"
            alt={`${wedding.couple.groom} and ${wedding.couple.bride}`}
            fill
            priority
            sizes="(min-width: 1024px) 520px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-sky-top/10 via-transparent to-ink/25" />

          {/* Flower branch — cropped from the real engagement photo */}
          <Image
            src="/images/decor/flower-branch.png"
            alt=""
            width={340}
            height={696}
            className="pointer-events-none absolute -left-4 -top-2 h-[38%] w-auto max-w-[65%] object-contain sm:h-[46%]"
          />
          <Image
            src="/images/decor/flower-branch.png"
            alt=""
            width={340}
            height={696}
            className="pointer-events-none absolute -right-4 -top-2 h-[22%] w-auto max-w-[45%] -scale-x-100 object-contain opacity-80 sm:h-[26%]"
          />
        </>
      )}

      <div className="relative flex h-full flex-col items-center px-6 pt-8 text-center">
        <p className="font-display text-2xl italic tracking-wide text-ink/85">You&apos;re Invited</p>
        <LeafSprig className="mt-2 h-3.5 w-12 text-leaf/70" />

        <p className="absolute right-6 top-8 font-script text-xl leading-tight text-dusk drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)]">
          A new
          <br />
          chapter
        </p>
        <HeartIcon className="absolute right-8 top-24 h-3.5 w-3.5 text-dusk" />

        <div className="mt-10">
          <p className="font-display text-5xl font-medium leading-none text-ink">{wedding.couple.groom}</p>
          <p className="font-display text-3xl italic leading-none text-dusk">&amp;</p>
          <p className="font-display text-5xl font-medium leading-none text-ink">Catherine</p>
        </div>

        <div className="mt-4 flex items-center gap-3 text-ink/70">
          <span className="h-px w-8 bg-ink/30" />
          <p className="tracked-caps font-body text-xs">Are Getting Married</p>
          <span className="h-px w-8 bg-ink/30" />
        </div>

        <div className="relative mt-6 flex flex-col items-center">
          <LeafSprig className="absolute -left-14 top-[3.56rem] h-3.5 w-10 -scale-x-100 text-leaf/70" />
          <LeafSprig className="absolute -right-14 top-[3.56rem] h-3.5 w-10 text-leaf/70" />
          {isSealLayer ? (
            <div className="pointer-events-auto visible">{seal}</div>
          ) : (
            <>
              <div className="h-32 w-32" />
              <p className={`invisible ${TAP_LABEL_CLASS}`}>Tap to Open</p>
            </>
          )}
        </div>

        <p className="tracked-caps absolute inset-x-0 bottom-6 font-body text-xs font-medium text-cream drop-shadow-[0_1px_4px_rgba(30,42,68,0.9)]">
          Together Forever
        </p>
      </div>
    </div>
  );
}

export function InvitationGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("closed");
  const { startPlayback } = useMusic();
  const sealRef = useRef<HTMLButtonElement>(null);

  const cracked = stage !== "closed";
  const opening = stage === "opening" || stage === "open";

  useEffect(() => {
    document.body.style.overflow = stage === "open" ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [stage]);

  function handleOpen() {
    if (stage !== "closed") return;
    // Called synchronously from this click — the one gesture every browser
    // reliably honors for starting audio, so the music begins the instant
    // the invitation opens instead of waiting for a separate Play tap.
    startPlayback();
    haptic([14, 40, 22]);
    setStage("cracking");

    const rect = sealRef.current?.getBoundingClientRect();
    if (rect) {
      burst({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        count: 80,
        speed: 950,
        shapes: ["petal", "petal", "heart"],
        size: [8, 14],
        life: 3.6,
      });
    }

    window.setTimeout(() => {
      setStage("opening");
      // A second, softer shower from above as the doors part.
      const width = window.innerWidth;
      for (const fraction of [0.15, 0.5, 0.85]) {
        burst({ x: width * fraction, y: -20, count: 16, angle: 90, spread: 120, speed: 260, life: 4.5 });
      }
    }, CRACK_MS);
    window.setTimeout(() => setStage("open"), OPEN_MS);
  }

  return (
    // reducedMotion="user": visitors who ask their OS for less motion get
    // plain fades site-wide instead of swinging doors and flying elements.
    <MotionConfig reducedMotion="user">
      <GateRevealedContext.Provider value={opening}>{children}</GateRevealedContext.Provider>

      <AnimatePresence>
        {stage !== "open" && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center lg:p-12"
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            {/* Backdrop — dissolves as the doors part, so the site shows through the gap. */}
            <motion.div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, var(--sky-top) 0%, var(--sky-bottom) 55%, var(--sky-bottom) 100%)",
              }}
              initial={false}
              animate={{ opacity: opening ? 0 : 1 }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            >
              {/* Ambient corner flourishes, only visible in the letterboxed
                  desktop backdrop around the card. */}
              <Image
                src="/images/decor/flower-branch.png"
                alt=""
                width={340}
                height={696}
                className="pointer-events-none absolute -left-10 -top-10 hidden h-[50%] w-auto object-contain opacity-70 lg:block"
              />
              <Image
                src="/images/decor/flower-branch.png"
                alt=""
                width={340}
                height={696}
                className="pointer-events-none absolute -right-10 -top-10 hidden h-[36%] w-auto -scale-x-100 object-contain opacity-50 lg:block"
              />
            </motion.div>

            <div
              className="relative h-full w-full lg:h-[min(860px,88vh)] lg:w-auto lg:aspect-[390/844]"
              style={{ perspective: 1000 }}
            >
              {/* Card shadow + ring live on their own layer (not the doors) so
                  the two halves never cast a dark band across the seam. */}
              <motion.div
                aria-hidden
                className="absolute inset-0 lg:rounded-[2.5rem] lg:shadow-2xl lg:ring-1 lg:ring-white/40"
                initial={false}
                animate={{ opacity: opening ? 0 : 1 }}
                transition={{ duration: 0.4 }}
              />

              {/* Light spilling through the seam as the gatefold opens. */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 28% 62% at 50% 50%, rgba(255,236,196,0.95) 0%, rgba(255,207,122,0.35) 45%, rgba(255,207,122,0) 75%)",
                }}
                initial={{ opacity: 0 }}
                animate={opening ? { opacity: [0, 1, 0] } : { opacity: 0 }}
                transition={{ duration: 1.3, times: [0, 0.35, 1], ease: "easeOut" }}
              />

              {(["left", "right"] as const).map((side) => {
                const isLeft = side === "left";
                return (
                  <motion.div
                    key={side}
                    className={`absolute inset-y-0 w-1/2 overflow-hidden ${
                      isLeft ? "left-0 lg:rounded-l-[2.5rem]" : "right-0 lg:rounded-r-[2.5rem]"
                    }`}
                    style={{ transformOrigin: isLeft ? "left center" : "right center", backfaceVisibility: "hidden" }}
                    initial={false}
                    // Swinging *away* from the viewer (into the screen) keeps
                    // each panel visible as a folding trapezoid the whole way;
                    // swinging toward the viewer projects it off-screen almost instantly.
                    animate={{ rotateY: opening ? (isLeft ? 100 : -100) : 0 }}
                    transition={{ duration: DOOR_S, ease: DOOR_EASE }}
                  >
                    <div className={`absolute inset-y-0 w-[200%] ${isLeft ? "left-0" : "right-0"}`}>
                      <GateFace />
                    </div>
                    {/* Each panel darkens as it turns away from the light. */}
                    <motion.div
                      aria-hidden
                      className="absolute inset-0 bg-ink"
                      initial={false}
                      animate={{ opacity: opening ? 0.6 : 0 }}
                      transition={{ duration: DOOR_S * 0.8, ease: "easeIn" }}
                    />
                  </motion.div>
                );
              })}

              <GateFace seal={<WaxSeal cracked={cracked} onOpen={handleOpen} sealRef={sealRef} />} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
