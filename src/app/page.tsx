import { InvitationGate } from "@/components/InvitationGate";
import { MusicProvider } from "@/components/MusicProvider";
import { MusicWidget } from "@/components/MusicWidget";
import { Hero } from "@/components/Hero";
import { OurStory } from "@/components/OurStory";
import { Celebrations } from "@/components/Celebrations";
import { Rsvp } from "@/components/Rsvp";
import { Gallery } from "@/components/Gallery";
import { Music } from "@/components/Music";
import { Note } from "@/components/Note";
import { Help } from "@/components/Help";
import { SiteFooter } from "@/components/SiteFooter";

export default function Home() {
  return (
    // MusicProvider wraps InvitationGate (not the other way around) because
    // the gate's own "Tap to Open" click has to reach into the music context
    // directly to start playback on that exact gesture.
    <MusicProvider>
      <InvitationGate>
        {/* On desktop the invitation gate itself frames its card at a phone
            aspect ratio (see InvitationGate's lg: classes) — once opened, the
            real content needs the same frame, or it just becomes a mobile
            column adrift in empty space. This mirrors that treatment.
            The backdrop gets its own fixed (viewport-anchored, not
            scroll-anchored) gradient — without `lg:bg-fixed` it would just
            show through whatever slice of the body's page-length gradient
            happens to be behind it, banding through different colors as the
            page scrolls instead of reading as one steady backdrop. */}
        <div className="lg:flex lg:justify-center lg:bg-gradient-to-b lg:from-sky-top lg:via-sky-bottom lg:to-sky-warm lg:bg-fixed lg:px-6 lg:py-12">
          <main className="flex flex-1 flex-col lg:max-w-[440px] lg:overflow-hidden lg:rounded-[2.5rem] lg:shadow-2xl lg:ring-1 lg:ring-white/40">
            <Hero />
            <OurStory />
            <Celebrations />
            <Rsvp />
            <Gallery />
            <Music />
            <Note />
            <Help />
            <SiteFooter />
          </main>
        </div>
      </InvitationGate>
      <MusicWidget />
    </MusicProvider>
  );
}
