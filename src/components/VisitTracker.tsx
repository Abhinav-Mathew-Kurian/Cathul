"use client";

import { useEffect } from "react";
import { startTracking, track } from "@/lib/track";
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

    // Marks how long they stayed: the last thing a visit hears is the tab
    // going to the background or closing.
    const onHide = () => document.visibilityState === "hidden" && track("ping");
    document.addEventListener("visibilitychange", onHide);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return null;
}
