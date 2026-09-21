type CalendarEvent = {
  title: string;
  description: string;
  location: string;
  start: Date;
  durationHours?: number;
};

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// Builds the raw .ics text. Call this only from a client event handler (it
// mints a fresh UID each call) — never during render, or the server- and
// client-rendered markup will disagree.
export function buildIcsContent(event: CalendarEvent): string {
  const end = new Date(
    event.start.getTime() + (event.durationHours ?? 3) * 60 * 60 * 1000
  );

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//wedding-site//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(event.start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description}`,
    `LOCATION:${event.location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// Reception venues are all in Kerala, so every visitor — regardless of their
// own device timezone — should see the same day/date/time. Formatting with
// an explicit timeZone keeps this deterministic across server and client
// render, unlike the countdown (which genuinely depends on "now").
const VENUE_TIME_ZONE = "Asia/Kolkata";

export function formatEventDateParts(startsAt: string) {
  const date = new Date(startsAt);
  const day = new Intl.DateTimeFormat("en-IN", { day: "2-digit", timeZone: VENUE_TIME_ZONE }).format(date);
  const month = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: VENUE_TIME_ZONE })
    .format(date)
    .toUpperCase();
  const year = new Intl.DateTimeFormat("en-IN", { year: "numeric", timeZone: VENUE_TIME_ZONE }).format(date);
  const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: VENUE_TIME_ZONE }).format(date);
  // en-US specifically for uppercase "AM"/"PM" — en-IN's ICU data lowercases it.
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: VENUE_TIME_ZONE,
  }).format(date);

  return { day, month, year, weekday, time: `${time} onwards` };
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const end = new Date(
    event.start.getTime() + (event.durationHours ?? 3) * 60 * 60 * 1000
  );
  const fmt = (d: Date) => toIcsDate(d);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${fmt(event.start)}/${fmt(end)}`,
    details: event.description,
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
