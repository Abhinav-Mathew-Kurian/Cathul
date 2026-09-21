"use client";

import { motion } from "motion/react";
import { wedding } from "@/content/wedding";
import { CallIcon, HeartIcon } from "./doodles";
import { FallingPetals } from "./FallingPetals";

const VIEWPORT = { once: true, margin: "-60px" } as const;

function ContactRow({
  contact,
  fromSide,
  delay,
}: {
  contact: { name: string; phone: string };
  fromSide: "left" | "right";
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: fromSide === "left" ? -28 : 28 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={VIEWPORT}
      transition={{ type: "spring", stiffness: 140, damping: 16, delay }}
      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[var(--card-shadow)]"
    >
      <div className="flex-1">
        <p className="font-body text-sm font-bold text-ink">{contact.name}</p>
        <p className="font-body text-xs text-ink/55">{contact.phone}</p>
      </div>
      <a
        href={`tel:${contact.phone.replace(/\s+/g, "")}`}
        aria-label={`Call ${contact.name}`}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cream text-rose-deep transition hover:bg-cream-deep"
      >
        <motion.span
          animate={{ rotate: [0, -18, 14, -10, 6, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 2.6, ease: "easeInOut", delay }}
        >
          <CallIcon className="h-4 w-4" />
        </motion.span>
      </a>
    </motion.div>
  );
}

function ContactSide({
  side,
  fromSide,
  groupDelay,
}: {
  side: (typeof wedding.help.sides)[number];
  fromSide: "left" | "right";
  groupDelay: number;
}) {
  return (
    <div>
      <p
        className={`flex items-center gap-2 font-hand text-2xl text-rose-deep ${
          fromSide === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {side.label}
        <span aria-hidden className="h-px flex-1 bg-ink/10" />
      </p>
      <div className="mt-3 space-y-3">
        {side.contacts.map((contact, i) => (
          <ContactRow
            key={contact.name}
            contact={contact}
            fromSide={fromSide}
            delay={groupDelay + i * 0.08}
          />
        ))}
      </div>
    </div>
  );
}

export function Help() {
  return (
    <section className="help-bg relative overflow-hidden px-5 pt-16 pb-16">
      <FallingPetals count={7} seedOffset={700} className="absolute inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="flex items-center justify-center gap-2 font-hand text-4xl text-ink sm:text-5xl">
            {wedding.help.heading}
            <HeartIcon className="h-5 w-5 text-rose" />
          </h2>
          <p className="mt-2 font-body text-sm text-ink/60">{wedding.help.subheading}</p>
        </motion.div>

        {/* Groom's side slides in from the left, bride's side from the right
            — two families meeting in the middle, rather than a generic list. */}
        <div className="mt-8 space-y-7">
          <ContactSide side={wedding.help.sides[0]} fromSide="left" groupDelay={0} />
          <ContactSide side={wedding.help.sides[1]} fromSide="right" groupDelay={0.1} />
        </div>

        <p className="mt-6 text-center font-body text-sm text-ink/55">{wedding.help.note}</p>
      </div>
    </section>
  );
}
