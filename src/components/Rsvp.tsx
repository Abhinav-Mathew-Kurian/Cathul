"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { wedding } from "@/content/wedding";
import { burst, CONFETTI_COLORS, haptic } from "@/lib/burst";
import { HeartIcon } from "./doodles";
import { JustMarriedCar } from "./JustMarriedCar";
import { BeatingHeart } from "./BeatingHeart";
import { FallingPetals } from "./FallingPetals";
import { StringLights } from "./StringLights";

const VIEWPORT = { once: true, margin: "-60px" } as const;

type Attendance = "yes" | "no" | "";
type Status = "idle" | "submitting" | "done" | "error";
type FormErrors = Partial<Record<"name" | "phone" | "attendance" | "events", string>>;

const ATTENDANCE_OPTIONS: { value: "yes" | "no"; label: string }[] = [
  { value: "yes", label: "Yes! Can't Wait" },
  { value: "no", label: "Sorry, Can't Make It" },
];

// The two real receptions, reused from Celebrations content rather than a
// second hardcoded list — if a venue/city ever changes there, this follows
// automatically instead of quietly going stale.
const RSVP_EVENTS = wedding.celebrations.events.map((event) => ({
  id: event.id,
  label: `${event.label} (${event.address})`,
}));
const ALL_EVENT_IDS = RSVP_EVENTS.map((event) => event.id);

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function isValidPhone(raw: string, countryCode: string): boolean {
  const digits = normalizePhoneDigits(raw);
  // Indian mobile numbers: 10 digits, starting 6-9. Other country codes get
  // a looser length check rather than guessing every country's format.
  if (countryCode === "+91") return /^[6-9]\d{9}$/.test(digits);
  return digits.length >= 7 && digits.length <= 15;
}

// Confetti cannon out of the submit button, then two side cannons from the
// bottom corners of the screen a beat later.
function celebrate(origin: DOMRect | undefined) {
  const x = origin ? origin.left + origin.width / 2 : window.innerWidth / 2;
  const y = origin ? origin.top + origin.height / 2 : window.innerHeight * 0.7;
  const shapes = ["confetti", "confetti", "petal", "heart"] as const;
  burst({ x, y, count: 130, angle: -90, spread: 75, speed: 1300, shapes: [...shapes], colors: CONFETTI_COLORS, life: 3.8 });
  window.setTimeout(() => {
    const h = window.innerHeight;
    burst({ x: -10, y: h, count: 60, angle: -60, spread: 30, speed: 1400, shapes: [...shapes], colors: CONFETTI_COLORS, life: 3.6 });
    burst({ x: window.innerWidth + 10, y: h, count: 60, angle: -120, spread: 30, speed: 1400, shapes: [...shapes], colors: CONFETTI_COLORS, life: 3.6 });
  }, 280);
  haptic([30, 60, 30, 60, 50]);
}

// A declined RSVP still gets something warm: a few hearts floating up.
function sendLove(origin: DOMRect | undefined) {
  const x = origin ? origin.left + origin.width / 2 : window.innerWidth / 2;
  const y = origin ? origin.top : window.innerHeight * 0.7;
  burst({ x, y, count: 18, angle: -90, spread: 50, speed: 520, shapes: ["heart"], colors: ["#c1594a", "#e6a99b"], size: [10, 16], life: 3 });
  haptic(20);
}

function validate(fields: {
  name: string;
  phone: string;
  countryCode: string;
  attendance: Attendance;
  events: string[];
}): FormErrors {
  const errors: FormErrors = {};
  if (!fields.name.trim()) errors.name = "Please enter your name.";
  // Optional — only validate format if they actually typed something.
  if (fields.phone.trim() && !isValidPhone(fields.phone, fields.countryCode)) {
    errors.phone = "Please enter a valid phone number.";
  }
  if (!fields.attendance) {
    errors.attendance = "Please tell us whether you'll be attending.";
  }
  if (fields.attendance === "yes" && fields.events.length === 0) {
    errors.events = "Please select at least one event.";
  }
  return errors;
}

export function Rsvp() {
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState(wedding.rsvp.countryCodes[0]);
  const [phone, setPhone] = useState("");
  const [attendance, setAttendance] = useState<Attendance>("");
  const [events, setEvents] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const submitRef = useRef<HTMLButtonElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const firstName = name.trim().split(/\s+/)[0];

  // "Both" is never stored as its own value — it's derived from whether
  // every real event is already selected. That way toggling either
  // individual event automatically keeps "Both" in sync (checked only when
  // both are, and it never has to be separately un-set), and the payload
  // sent to the server always lists the actual events chosen.
  const bothChecked = ALL_EVENT_IDS.length > 0 && ALL_EVENT_IDS.every((id) => events.includes(id));

  // The thank-you card is far shorter than the form it replaces — without
  // this, browsers with no scroll anchoring (iOS Safari) can leave it
  // above the viewport while the confetti flies.
  useEffect(() => {
    if (status !== "done") return;
    const id = window.setTimeout(
      () => successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      350
    );
    return () => window.clearTimeout(id);
  }, [status]);

  function toggleEvent(id: string) {
    setEvents((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  function toggleBoth() {
    setEvents(bothChecked ? [] : ALL_EVENT_IDS);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nextErrors = validate({ name, phone, countryCode, attendance, events });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("submitting");

    const payload = {
      name: name.trim(),
      phone: phone.trim() ? `${countryCode} ${normalizePhoneDigits(phone)}` : "",
      attending: attendance,
      events,
      message: message.trim(),
    };

    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");
      const origin = submitRef.current?.getBoundingClientRect();
      if (attendance === "yes") celebrate(origin);
      else sendLove(origin);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="rsvp" className="rsvp-bg relative overflow-hidden px-5 pt-16 pb-6">
      <StringLights seedOffset={300} />
      <FallingPetals count={9} seedOffset={300} className="absolute inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="flex items-center justify-center gap-2 font-hand text-4xl text-ink sm:text-5xl">
            {wedding.rsvp.heading}
            <BeatingHeart className="h-5 w-5 text-rose" />
          </h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-ink/60">
            {wedding.rsvp.subheading.map((line, i) => (
              <Fragment key={line}>
                {line}
                {i < wedding.rsvp.subheading.length - 1 && <br />}
              </Fragment>
            ))}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-8"
        >
          {/* The form flips over like a card to reveal the thank-you on its back. */}
          <div style={{ perspective: 1200 }}>
          <AnimatePresence mode="wait" initial={false}>
          {status === "done" ? (
            <motion.div
              key="done"
              ref={successRef}
              initial={{ rotateY: -90, opacity: 0.6 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 140, damping: 16 }}
              className="flex flex-col items-center overflow-hidden rounded-3xl border border-ink/10 bg-white/70 px-6 pt-10 pb-4 text-center shadow-[var(--card-shadow)]"
            >
              <motion.div
                initial={{ rotate: -20, scale: 0 }}
                animate={{ rotate: -6, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 11, delay: 0.25 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose text-white"
              >
                <HeartIcon className="h-7 w-7" />
              </motion.div>
              {/* Written out left to right, like it's being penned on the spot. */}
              <motion.p
                initial={{ clipPath: "inset(0 100% 0 0)" }}
                animate={{ clipPath: "inset(0 0% 0 0)" }}
                transition={{ duration: 1.3, delay: 0.45, ease: [0.5, 0, 0.3, 1] }}
                className="mt-5 font-hand text-3xl text-ink"
              >
                {attendance === "yes"
                  ? `See you there${firstName ? `, ${firstName}` : ""}!`
                  : `We'll miss you${firstName ? `, ${firstName}` : ""}!`}
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.5 }}
                className="mt-2 font-body text-sm text-ink/65"
              >
                {attendance === "yes"
                  ? "You're on the list. Can't wait to celebrate with you."
                  : "Thank you for letting us know. You'll be in our hearts on the day."}
              </motion.p>
              {attendance === "yes" && (
                <div className="-mx-6 mt-4 w-[calc(100%+3rem)]">
                  <JustMarriedCar />
                </div>
              )}
            </motion.div>
          ) : (
            <motion.form
              key="form"
              exit={{ rotateY: 90, opacity: 0.6, transition: { duration: 0.28, ease: "easeIn" } }}
              onSubmit={handleSubmit}
              noValidate
              className="space-y-5 text-left"
            >
              <div>
                <label htmlFor="rsvp-name" className="font-body text-sm font-bold text-ink">
                  Your Name <span className="text-rose">*</span>
                </label>
                <input
                  id="rsvp-name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Menon"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "rsvp-name-error" : undefined}
                  className={`mt-1.5 w-full rounded-xl border bg-white/85 px-3.5 py-3 font-body text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:border-rose ${
                    errors.name ? "border-rose-deep" : "border-ink/15"
                  }`}
                />
                {errors.name && (
                  <p id="rsvp-name-error" role="alert" className="mt-1 font-body text-xs text-rose-deep">
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="rsvp-phone" className="font-body text-sm font-bold text-ink">
                  Phone Number
                </label>
                <div className="mt-1.5 flex gap-2">
                  <select
                    aria-label="Country code"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="flex-shrink-0 rounded-xl border border-ink/15 bg-white/85 px-2.5 py-3 font-body text-sm text-ink focus:border-rose focus:outline-none"
                  >
                    {wedding.rsvp.countryCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <input
                    id="rsvp-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 98765 43210"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "rsvp-phone-error" : undefined}
                    className={`min-w-0 flex-1 rounded-xl border bg-white/85 px-3.5 py-3 font-body text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:border-rose ${
                      errors.phone ? "border-rose-deep" : "border-ink/15"
                    }`}
                  />
                </div>
                {errors.phone && (
                  <p id="rsvp-phone-error" role="alert" className="mt-1 font-body text-xs text-rose-deep">
                    {errors.phone}
                  </p>
                )}
              </div>

              <fieldset aria-describedby={errors.attendance ? "rsvp-attendance-error" : undefined}>
                <legend className="font-body text-sm font-bold text-ink">
                  Will you attend? <span className="text-rose">*</span>
                </legend>
                <div className="mt-2 flex gap-3">
                  {ATTENDANCE_OPTIONS.map((option) => {
                    const checked = attendance === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`flex-1 cursor-pointer rounded-full px-3 py-3 text-center font-body text-xs font-bold transition focus-within:ring-2 focus-within:ring-rose focus-within:ring-offset-2 ${
                          checked
                            ? "bg-rose text-white shadow-[var(--card-shadow)]"
                            : "border border-ink/15 bg-white/70 text-ink/55"
                        }`}
                      >
                        <input
                          type="radio"
                          name="attendance"
                          value={option.value}
                          checked={checked}
                          onChange={() => {
                            setAttendance(option.value);
                            if (option.value === "no") setEvents([]);
                          }}
                          className="sr-only"
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
                {errors.attendance && (
                  <p id="rsvp-attendance-error" role="alert" className="mt-1.5 font-body text-xs text-rose-deep">
                    {errors.attendance}
                  </p>
                )}
              </fieldset>

              {attendance === "yes" && (
                <fieldset aria-describedby={errors.events ? "rsvp-events-error" : undefined}>
                  <legend className="font-body text-sm font-bold text-ink">
                    Which event(s) will you attend? <span className="text-rose">*</span>
                  </legend>
                  <div className="mt-2 space-y-2">
                    {RSVP_EVENTS.map((option) => (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink/15 bg-white/70 px-3.5 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={events.includes(option.id)}
                          onChange={() => toggleEvent(option.id)}
                          className="h-4 w-4 accent-rose"
                        />
                        <span className="font-body text-sm text-ink">{option.label}</span>
                      </label>
                    ))}
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink/15 bg-white/70 px-3.5 py-3">
                      <input
                        type="checkbox"
                        checked={bothChecked}
                        onChange={toggleBoth}
                        className="h-4 w-4 accent-rose"
                      />
                      <span className="font-body text-sm text-ink">{wedding.rsvp.bothEventsLabel}</span>
                    </label>
                  </div>
                  {errors.events && (
                    <p id="rsvp-events-error" role="alert" className="mt-1.5 font-body text-xs text-rose-deep">
                      {errors.events}
                    </p>
                  )}
                </fieldset>
              )}

              <div>
                <label htmlFor="rsvp-message" className="font-body text-sm font-bold text-ink">
                  Any message for the couple?
                </label>
                <textarea
                  id="rsvp-message"
                  name="message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Best wishes!"
                  className="mt-1.5 w-full resize-y rounded-xl border border-ink/15 bg-white/85 px-3.5 py-3 font-body text-sm text-ink placeholder:text-ink/35 focus:border-rose focus:outline-none"
                />
              </div>

              <button
                ref={submitRef}
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-full bg-rose py-4 font-body text-sm font-bold text-white shadow-[var(--card-shadow)] transition hover:bg-rose-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Submitting..." : "Submit RSVP"}
              </button>

              {status === "error" && (
                <p role="alert" className="text-center font-body text-xs text-rose-deep">
                  Something went wrong. Please try again.
                </p>
              )}
            </motion.form>
          )}
          </AnimatePresence>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="relative -mx-5 mt-10 aspect-[3/2] overflow-hidden"
        >
          <Image
            src={wedding.rsvp.bottomImage}
            alt="Athul and Catherine driving off together, seen from behind, with a Just Married(ish) sign"
            fill
            sizes="(max-width: 640px) 100vw, 500px"
            loading="lazy"
            className="object-contain"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[var(--sky-bottom)] to-transparent"
          />
        </motion.div>
      </div>
    </section>
  );
}
