"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { wedding } from "@/content/wedding";
import { HeartIcon, LeafSprig } from "./doodles";
import { useMusic } from "./MusicProvider";

type Stage = "closed" | "opening" | "open";

// Deterministic pseudo-randomness (no Math.random) so this stays a pure
// render — each petal's spread comes from its own index instead.
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Petals() {
  const petals = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        id: i,
        left: Math.round(seeded(i, 1) * 100),
        delay: seeded(i, 2) * 0.6,
        duration: 2.2 + seeded(i, 3) * 1.2,
        size: 7 + Math.round(seeded(i, 4) * 6),
        rotate: Math.round(seeded(i, 5) * 360),
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {petals.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -40, x: 0, opacity: 0, rotate: 0 }}
          animate={{
            y: "110vh",
            x: [0, 12, -12, 0],
            opacity: [0, 1, 1, 0],
            rotate: p.rotate,
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            width: p.size,
            height: p.size,
            borderRadius: "60% 40% 60% 40%",
            background: "#fdfbf3",
            boxShadow: "0 0 0 1px rgba(30,42,68,0.06)",
          }}
        />
      ))}
    </div>
  );
}

export function InvitationGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("closed");
  const { startPlayback } = useMusic();

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
    setStage("opening");
    window.setTimeout(() => setStage("open"), 900);
  }

  return (
    <>
      {children}

      <AnimatePresence>
        {stage !== "open" && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden lg:p-12"
            style={{
              background:
                "linear-gradient(180deg, var(--sky-top) 0%, var(--sky-bottom) 55%, var(--sky-bottom) 100%)",
            }}
            exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.35 } }}
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

            <motion.div
              className="relative h-full w-full overflow-hidden lg:h-[min(860px,88vh)] lg:w-auto lg:aspect-[390/844] lg:rounded-[2.5rem] lg:shadow-2xl lg:ring-1 lg:ring-white/40"
              animate={stage === "opening" ? { scale: 1.06, opacity: 0 } : { scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeIn" }}
            >
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

              <div className="relative flex h-full flex-col items-center px-6 pt-8 text-center">
              <p className="font-display text-2xl italic tracking-wide text-ink/85">
                You&apos;re Invited
              </p>
              <LeafSprig className="mt-2 h-3.5 w-12 text-leaf/70" />

              <p className="absolute right-6 top-8 font-script text-xl leading-tight text-dusk drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)]">
                A new
                <br />
                chapter
              </p>
              <HeartIcon className="absolute right-8 top-24 h-3.5 w-3.5 text-dusk" />

              <div className="mt-10">
                <p className="font-display text-5xl font-medium leading-none text-ink">
                  {wedding.couple.groom}
                </p>
                <p className="font-display text-3xl italic leading-none text-dusk">&amp;</p>
                <p className="font-display text-5xl font-medium leading-none text-ink">
                  {wedding.couple.bride}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-3 text-ink/70">
                <span className="h-px w-8 bg-ink/30" />
                <p className="tracked-caps font-body text-xs">Are Getting Married</p>
                <span className="h-px w-8 bg-ink/30" />
              </div>

              <motion.div
                role="button"
                tabIndex={0}
                aria-label="Open your wedding invitation"
                onClick={handleOpen}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleOpen()}
                animate={
                  stage === "opening"
                    ? { scale: 0.85, opacity: 0 }
                    : { y: [0, -6, 0] }
                }
                transition={
                  stage === "opening"
                    ? { duration: 0.6, ease: "easeIn" }
                    : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
                }
                className="relative mt-6 flex cursor-pointer select-none items-center justify-center"
              >
                <LeafSprig className="absolute -left-14 h-3.5 w-10 -scale-x-100 text-leaf/70" />
                <LeafSprig className="absolute -right-14 h-3.5 w-10 text-leaf/70" />

                <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full border border-ink/25 bg-cream/95 shadow-[var(--card-shadow)]">
                  <div className="flex h-[6.75rem] w-[6.75rem] flex-col items-center justify-center rounded-full border border-ink/15">
                    <HeartIcon className="h-5 w-5 text-rose" />
                    <p className="tracked-caps mt-1.5 font-body text-[10px] font-medium text-ink/80">
                      Tap to Open
                    </p>
                  </div>
                </div>
              </motion.div>

              <p className="tracked-caps absolute inset-x-0 bottom-6 font-body text-xs font-medium text-cream drop-shadow-[0_1px_4px_rgba(30,42,68,0.9)]">
                Together Forever
              </p>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {stage === "opening" && <Petals />}
    </>
  );
}
