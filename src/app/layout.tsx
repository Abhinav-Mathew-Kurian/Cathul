import type { Metadata, Viewport } from "next";
import { Caveat, Cormorant_Garamond, Jost, Sacramento } from "next/font/google";
import "./globals.css";
import { wedding } from "@/content/wedding";
import { formatEventDateParts } from "@/lib/calendar";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const sacramento = Sacramento({
  variable: "--font-sacramento",
  subsets: ["latin"],
  weight: "400",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const { groom, brideFull } = wedding.couple;
const couple = `${groom} & ${brideFull}`;
const title = `${couple} are getting married! You are invited!`;

// e.g. "Mon, 16 Nov 2026, 6:00 PM at Suvarnabhumi Auditorium, Kannur" — built
// from the same startsAt values the Celebrations cards use, so they never drift.
const receptionLines = wedding.celebrations.events.map((event) => {
  const { day, month, year, weekday, time } = formatEventDateParts(event.startsAt);
  const clock = time.replace(" onwards", "");
  const monthName = month.charAt(0) + month.slice(1).toLowerCase();
  return `${weekday.slice(0, 3)}, ${day} ${monthName} ${year}, ${clock} at ${event.venueName}, ${event.address}`;
});

const description = `${couple} are getting married, and you're invited! ${wedding.tagline} Join us for the receptions: ${receptionLines.join("; ")}, Kerala. Read our story, browse the gallery, add the dates to your calendar, and RSVP.`;

// The icon, apple-icon, favicon and share images come from the files in
// src/app (icon.png, apple-icon.png, favicon.ico, opengraph-image.jpg,
// twitter-image.jpg + their .alt.txt) — Next.js wires those into <head> on its own.
export const metadata: Metadata = {
  metadataBase: new URL(wedding.siteUrl),
  title: {
    default: title,
    template: `%s · ${couple}`,
  },
  description,
  applicationName: couple,
  category: "wedding",
  keywords: [
    `${groom} and ${brideFull}`,
    `${groom} weds ${brideFull}`,
    `${groom} ${brideFull} wedding`,
    "athulwedscathy",
    "wedding invitation",
    "wedding reception",
    "Kerala wedding",
    "Kannur wedding reception",
    "Idukki wedding reception",
    ...wedding.celebrations.events.map((event) => event.venueName),
    "November 2026 wedding",
    "RSVP",
  ],
  authors: [{ name: couple, url: wedding.siteUrl }],
  creator: couple,
  publisher: couple,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: couple,
    title,
    description,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  appleWebApp: { title: couple, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

// Tells search engines about the two receptions, so they can show up as
// events (date, venue, city) rather than just a plain link.
const eventsJsonLd = {
  "@context": "https://schema.org",
  "@graph": wedding.celebrations.events.map((event) => ({
    "@type": "Event",
    name: `${couple} — ${event.label}`,
    startDate: event.startsAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: [`${wedding.siteUrl}/opengraph-image.jpg`],
    description: `${couple} are getting married! ${event.note.map((line) => (/[.!?]$/.test(line) ? line : `${line}.`)).join(" ")}`,
    url: wedding.siteUrl,
    location: {
      "@type": "Place",
      name: event.venueName,
      address: { "@type": "PostalAddress", streetAddress: event.fullAddress, addressRegion: "Kerala", addressCountry: "IN" },
    },
    organizer: [
      { "@type": "Person", name: groom },
      { "@type": "Person", name: brideFull },
    ],
  })),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#7dc9e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jost.variable} ${sacramento.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventsJsonLd).replace(/</g, "\\u003c") }}
        />
        {children}
      </body>
    </html>
  );
}
