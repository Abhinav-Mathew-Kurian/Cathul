"use client";

import { useEffect } from "react";
import { startTracking, track, watchActiveTime } from "@/lib/track";
import { SECTIONS, type Section } from "@/lib/sections";

// Counts the visit and how far down the invitation it gets. A section counts
// as reached once it crosses the middle of the screen.
export function VisitTracker() {
  useEffect(() => {
    startTracking();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) track(`section:${entry.target.id as Section}`);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    for (const id of SECTIONS) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }

    // How long they really spent — reported whenever the page is hidden.
    const stopWatching = watchActiveTime();
    return () => {
      observer.disconnect();
      stopWatching();
    };
  }, []);

  return null;
}
