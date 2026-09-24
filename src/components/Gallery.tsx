"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { wedding, type GalleryPhoto } from "@/content/wedding";
import { CameraIcon, HeartIcon } from "./doodles";
import { FallingPetals } from "./FallingPetals";
import { StringLights } from "./StringLights";

const VIEWPORT = { once: true, margin: "-60px" } as const;

export function Gallery() {
  const [active, setActive] = useState<GalleryPhoto | null>(null);

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
            <HeartIcon className="h-5 w-5 text-rose" />
          </h2>
          <p className="mt-2 font-body text-sm text-ink/60">{wedding.gallery.subheading}</p>
        </motion.div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {wedding.gallery.photos.map((photo, i) => (
            <motion.button
              key={photo.id}
              type="button"
              onClick={() => setActive(photo)}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.5, delay: (i % 6) * 0.05 }}
              className="group relative aspect-square overflow-hidden rounded-2xl shadow-[var(--card-shadow)]"
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
            </motion.button>
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
          className="relative -mx-5 mt-8 aspect-[6/7] overflow-hidden sm:aspect-[3/2]"
        >
          <Image
            src={wedding.gallery.endingImage}
            alt="Athul and Catherine laughing together"
            fill
            sizes="(max-width: 640px) 100vw, 500px"
            loading="lazy"
            className="object-cover object-top sm:object-center"
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
              <div className="relative aspect-square overflow-hidden rounded-t-2xl">
                <Image
                  src={active.image}
                  alt={active.caption}
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              </div>
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
