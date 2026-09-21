import Image from "next/image";
import { wedding } from "@/content/wedding";

export function SiteFooter() {
  return (
    <footer className="relative aspect-square w-full overflow-hidden bg-white">
      <Image
        src={wedding.footerImage}
        alt={`Thank you for being a part of ${wedding.couple.groom} and ${wedding.couple.bride}'s story`}
        fill
        sizes="(max-width: 640px) 100vw, 500px"
        loading="lazy"
        className="object-cover"
      />
      {/* The artwork's own background is white, not the site's sky blue —
          fade the seam so Help's blue doesn't cut hard into it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[var(--sky-bottom)] to-transparent"
      />
    </footer>
  );
}
