"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { wedding, type GalleryPhoto } from "@/content/wedding";
import { burst, haptic } from "@/lib/burst";
import { CameraIcon, HeartIcon } from "./doodles";
import { BeatingHeart } from "./BeatingHeart";
import { FallingPetals } from "./FallingPetals";
import { StringLights } from "./StringLights";

const VIEWPORT = { once: true, margin: "-60px" } as const;

const DOUBLE_TAP_MS = 280;
const HEART_COLORS = ["#c1594a", "#e6a99b", "#f6d9ce", "#fdfbf3"];

// A quick second tap turns a tap into a "like". The first tap waits one
// DOUBLE_TAP_MS beat before doing its single-tap job, to see if a second follows.
function useDoubleTap(onDouble: (e: MouseEvent<HTMLElement>) => void, onSingle?: () => void) {
  const timer = useRef<number | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current ?? undefined), []);

  return (e: MouseEvent<HTMLElement>) => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      onDouble(e);
      return;
    }
    // Keyboard activation (detail 0) can't double-tap — open straight away.
    if (e.detail === 0) {
      onSingle?.();
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onSingle?.();
    }, DOUBLE_TAP_MS);
  };
}

// The big heart that pops over a photo on double-tap. Several can overlap if
// someone keeps tapping; each removes itself when its CSS animation ends.
function useHeartPops(onLike: () => void) {
  const [pops, setPops] = useState<number[]>([]);
  const nextId = useRef(0);

  function pop(e: MouseEvent<HTMLElement>) {
    const id = nextId.current++;
    setPops((current) => [...current, id]);
    burst({
      x: e.clientX,
      y: e.clientY,
      count: 12,
      speed: 420,
      shapes: ["heart"],
      colors: HEART_COLORS,
      size: [6, 11],
      life: 1.8,
    });
    haptic(12);
    onLike();
  }

  const layer = pops.map((id) => (
    <span
      key={id}
      aria-hidden
      className="heart-pop pointer-events-none absolute left-1/2 top-1/2 z-10 h-20 w-20 text-white"
      onAnimationEnd={() => setPops((current) => current.filter((p) => p !== id))}
    >
      <HeartIcon className="h-full w-full drop-shadow-[0_4px_14px_rgba(164,72,59,0.6)]" />
    </span>
  ));

  return { pop, layer };
}

function PhotoTile({
  photo,
  index,
  liked,
  onOpen,
  onLike,
}: {
  photo: GalleryPhoto;
  index: number;
  liked: boolean;
  onOpen: () => void;
  onLike: () => void;
}) {
  const hearts = useHeartPops(onLike);
  const handleTap = useDoubleTap(hearts.pop, onOpen);

  return (
    <motion.button
      type="button"
      onClick={handleTap}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.5, delay: (index % 6) * 0.05 }}
      // touch-manipulation stops iOS treating the double-tap as a zoom.
      className="group relative aspect-square touch-manipulation overflow-hidden rounded-2xl shadow-[var(--card-shadow)]"
    >
      <Image
        src={photo.image}
        alt={photo.caption}
        fill
        sizes="(min-width: 640px) 200px, 45vw"
        className="object-cover transition duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/60 to-transparent px-2.5 pb-2 pt-6">
        <p className="text-left font-body text-xs font-semibold text-white">{photo.caption}</p>
      </div>
      <AnimatePresence>
        {liked && (
          <motion.span
            aria-label="Liked"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.35 }}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-rose shadow-sm"
          >
            <HeartIcon className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
      {hearts.layer}
    </motion.button>
  );
}

function LightboxPhoto({ photo, onLike }: { photo: GalleryPhoto; onLike: () => void }) {
  const hearts = useHeartPops(onLike);
  const handleTap = useDoubleTap(hearts.pop);

  return (
    <div
      className="relative aspect-square touch-manipulation overflow-hidden rounded-t-2xl"
      onClick={handleTap}
    >
      <Image src={photo.image} alt={photo.caption} fill sizes="320px" className="object-cover" />
      {hearts.layer}
    </div>
  );
}

export function Gallery() {
  const [active, setActive] = useState<GalleryPhoto | null>(null);
  const [liked, setLiked] = useState<ReadonlySet<string>>(() => new Set());

  function like(id: string) {
    setLiked((current) => (current.has(id) ? current : new Set(current).add(id)));
  }

  return (
    <section id="gallery" className="gallery-bg relative overflow-hidden px-5 pt-16 pb-6">
      <StringLights seedOffset={400} />
      <FallingPetals count={8} seedOffset={400} className="absolute inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="flex items-center justify-center gap-2 font-hand text-4xl text-ink sm:text-5xl">
            {wedding.gallery.heading}
            <BeatingHeart className="h-5 w-5 text-rose" />
          </h2>
          <p className="mt-2 font-body text-sm text-ink/60">{wedding.gallery.subheading}</p>
        </motion.div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {wedding.gallery.photos.map((photo, i) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              index={i}
              liked={liked.has(photo.id)}
              onOpen={() => setActive(photo)}
              onLike={() => like(photo.id)}
            />
          ))}

          {/* Spans both columns and centers a single half-width tile — with
              an even number of photos this would otherwise land alone in
              the left column, stuck off-center. */}
          <div className="col-span-2 flex justify-center sm:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.5, delay: (wedding.gallery.photos.length % 6) * 0.05 }}
              className="flex aspect-square w-1/2 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 text-ink/45 sm:w-1/3"
            >
              <CameraIcon className="h-6 w-6" />
              <p className="text-center font-body text-xs font-semibold">
                More memories
                <br />
                loading...
              </p>
            </motion.div>
          </div>
        </div>

        <p className="mt-9 text-center font-body text-sm font-semibold text-ink/65">
          {wedding.gallery.closing}
          <HeartIcon className="ml-1.5 inline-block h-4 w-4 -translate-y-0.5 text-rose" />
        </p>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          // Same shape as the portrait itself (1164×1351) at every width, so
          // nothing is ever cropped — a wider desktop frame cut their heads off.
          className="relative -mx-5 mt-8 aspect-[1164/1351] overflow-hidden"
        >
          <Image
            src={wedding.gallery.endingImage}
            alt="Athul and Catherine laughing together"
            fill
            sizes="(max-width: 640px) 100vw, 500px"
            loading="lazy"
            className="object-cover"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[var(--sky-bottom)] to-transparent"
          />
          {/* Fades into the Music section's identical flat background right
              below it, so the two sections meet with no hard seam. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[var(--sky-bottom)] to-transparent"
          />
        </motion.div>
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-6"
            onClick={() => setActive(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="relative w-full max-w-xs rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Only the photo needs clipping to the card's rounded top
                  corners — clipping the whole card cut off the close button,
                  which is deliberately positioned to hang off its edge. */}
              <LightboxPhoto photo={active} onLike={() => like(active.id)} />
              <p className="rounded-b-2xl bg-white p-4 text-center font-body text-sm font-semibold text-ink">
                {active.caption}
              </p>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-rose text-white shadow-md"
                aria-label="Close photo"
              >
                ×
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
