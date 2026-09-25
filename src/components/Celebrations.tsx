"use client";

import { Fragment } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { wedding, type ReceptionEvent } from "@/content/wedding";
import { buildIcsContent, formatEventDateParts } from "@/lib/calendar";
import { CalendarIcon, HeartIcon, PinIcon } from "./doodles";
import { BeatingHeart } from "./BeatingHeart";
import { FallingPetals } from "./FallingPetals";
import { Garland } from "./Garland";
import { StringLights } from "./StringLights";

const VIEWPORT = { once: true, margin: "-60px" } as const;

function DateTile({ startsAt }: { startsAt: string }) {
  const { day, month, year } = formatEventDateParts(startsAt);
  return (
    <div className="flex h-32 w-16 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-ink/10 bg-white shadow-[var(--card-shadow)]">
      <span className="font-display text-4xl leading-none font-bold text-ink">{day}</span>
      <span className="h-px w-6 bg-ink/10" />
      <span className="text-[11px] font-bold tracking-wide text-rose-deep/80">{month}</span>
      <span className="text-[10px] font-medium text-ink/40">{year}</span>
    </div>
  );
}

function ReceptionCard({ event, index }: { event: ReceptionEvent; index: number }) {
  const { weekday, time } = formatEventDateParts(event.startsAt);
  const isGroom = event.type === "groom";
  const delay = index * 0.12;

  function downloadIcs() {
    const start = new Date(event.startsAt);
    const blob = new Blob(
      [
        buildIcsContent({
          title: `${event.label} — ${wedding.couple.groom} & ${wedding.couple.bride}`,
          description: event.note.join(" "),
          location: `${event.venueName}, ${event.address}`,
          start,
        }),
      ],
      { type: "text/calendar;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.id}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.65, delay, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-[2rem] border border-ink/5 p-5 shadow-[var(--card-shadow)] ${
        isGroom ? "bg-gradient-to-b from-cream to-sky-bottom/70" : "bg-gradient-to-b from-cream to-rose/10"
      }`}
    >
      <h3 className="font-hand text-3xl font-bold text-ink">{event.label}</h3>

      <div className="mt-3 flex items-start gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, delay: delay + 0.15, ease: "easeOut" }}
          className="relative -my-3 h-32 w-20 flex-shrink-0"
        >
          {/* The vignette mask fades out the box's outer ~16% on every edge —
              inset the image well clear of that ring, or it fades the top of
              the character's head into the card background. */}
          <div className="photo-vignette absolute inset-0">
            <div className="absolute inset-x-2 top-8 bottom-0">
              <Image
                src={event.character}
                alt=""
                aria-hidden
                fill
                sizes="80px"
                className="object-contain object-bottom"
              />
            </div>
          </div>
        </motion.div>

        <div className="flex flex-1 items-start gap-3 pt-1">
          <DateTile startsAt={event.startsAt} />
          <div className="pt-0.5">
            <p className="font-body text-sm font-bold text-ink">{weekday}</p>
            <p className="font-body text-xs text-ink/55">{time}</p>
            <p className="mt-2 flex items-start gap-1 font-body text-sm font-semibold text-ink">
              <PinIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose" />
              <span>
                {event.venueName}
                <span className="block font-normal text-ink/55">{event.address}</span>
                <span className="block text-xs font-normal text-ink/40">{event.fullAddress}</span>
              </span>
            </p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, delay: delay + 0.2, ease: "easeOut" }}
        className="relative -mx-5 mt-4 h-44 overflow-hidden sm:h-56"
      >
        <Image
          src={`${event.image}?w=1200&q=75&auto=format&fit=crop`}
          alt={`Scenery near ${event.address}, the ${event.label.toLowerCase()} venue`}
          fill
          sizes="(max-width: 640px) 90vw, 400px"
          loading="lazy"
          className="object-cover"
        />
      </motion.div>

      <div className="mt-4 flex gap-2.5">
        <a
          href={event.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 py-3 font-body text-xs font-bold text-ink shadow-sm transition hover:bg-cream-deep"
        >
          <PinIcon className="h-3.5 w-3.5 text-rose" />
          View on Map
        </a>
        <button
          type="button"
          onClick={downloadIcs}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-rose px-3 py-3 font-body text-xs font-bold text-white transition hover:bg-rose-deep"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          Add to Calendar
        </button>
      </div>

      <p className="mt-4 text-center font-hand text-lg leading-snug text-ink/70">
        {event.note.map((line, i) => (
          <span key={line} className="block">
            {line}
            {event.noteHeart && i === event.note.length - 1 && (
              <HeartIcon className="ml-1 inline-block h-3 w-3 -translate-y-0.5 text-rose" />
            )}
          </span>
        ))}
      </p>
    </motion.div>
  );
}

export function Celebrations() {
  return (
    <section id="celebrations" className="celebrations-bg relative overflow-hidden px-5 pt-16 pb-16">
      <StringLights seedOffset={200} />
      <FallingPetals count={8} seedOffset={200} className="absolute inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="flex items-center justify-center gap-2 font-hand text-4xl text-ink sm:text-5xl">
            {wedding.celebrations.heading}
            <BeatingHeart className="h-5 w-5 text-rose" />
          </h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-ink/60">
            {wedding.celebrations.subheading.map((line, i) => (
              <Fragment key={line}>
                {line}
                {i < wedding.celebrations.subheading.length - 1 && <br />}
              </Fragment>
            ))}
          </p>
        </motion.div>

        <Garland className="mt-6 -mx-5 h-10" />

        <div className="mt-10 flex flex-col gap-8">
          {wedding.celebrations.events.map((event, i) => (
            <ReceptionCard key={event.id} event={event} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
