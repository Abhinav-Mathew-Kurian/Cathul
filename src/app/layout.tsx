import type { Metadata, Viewport } from "next";
import { Caveat, Cormorant_Garamond, Jost, Sacramento } from "next/font/google";
import "./globals.css";
import { wedding } from "@/content/wedding";

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

const { groom, bride } = wedding.couple;
const title = `${groom} & ${bride} are getting married`;
const description = `${groom} & ${bride} are getting married! Join us for the receptions in Kannur (16 Nov 2026) and Idukki (22 Nov 2026) — our story, the celebrations, and how to RSVP.`;

// The icon, apple-icon, favicon and share images come from the files in
// src/app (icon.png, apple-icon.png, favicon.ico, opengraph-image.jpg,
// twitter-image.jpg) — Next.js wires those into <head> on its own.
export const metadata: Metadata = {
  metadataBase: new URL(wedding.siteUrl),
  title: {
    default: title,
    template: `%s · ${groom} & ${bride}`,
  },
  description,
  applicationName: `${groom} & ${bride}`,
  keywords: [
    `${groom} and ${bride}`,
    `${groom} weds ${bride}`,
    `${groom} ${bride} wedding`,
    "wedding invitation",
    "wedding reception",
    "Kannur",
    "Idukki",
    "Kerala wedding",
    "RSVP",
  ],
  authors: [{ name: `${groom} & ${bride}` }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: `${groom} & ${bride}`,
    title,
    description,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: { index: true, follow: true },
  appleWebApp: { title: `${groom} & ${bride}`, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

// Tells search engines about the two receptions, so they can show up as
// events (date, venue, city) rather than just a plain link.
const eventsJsonLd = {
  "@context": "https://schema.org",
  "@graph": wedding.celebrations.events.map((event) => ({
    "@type": "Event",
    name: `${groom} & ${bride} — ${event.label}`,
    startDate: event.startsAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: [`${wedding.siteUrl}/opengraph-image.jpg`],
    description: event.note.join(" "),
    url: wedding.siteUrl,
    location: {
      "@type": "Place",
      name: event.venueName,
      address: { "@type": "PostalAddress", streetAddress: event.fullAddress, addressRegion: "Kerala", addressCountry: "IN" },
    },
    organizer: { "@type": "Person", name: `${groom} & ${bride}`, url: wedding.siteUrl },
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
