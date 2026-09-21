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

export const metadata: Metadata = {
  title: `${wedding.couple.groom} & ${wedding.couple.bride} are getting married`,
  description: `Join us to celebrate ${wedding.couple.groom} and ${wedding.couple.bride} — our story, the celebrations, and how to RSVP.`,
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
        {children}
      </body>
    </html>
  );
}
