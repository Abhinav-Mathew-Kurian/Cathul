import type { MetadataRoute } from "next";
import { wedding } from "@/content/wedding";

// Lets guests "Add to Home Screen" with the couple's photo as the app icon.
export default function manifest(): MetadataRoute.Manifest {
  const { groom, bride } = wedding.couple;
  return {
    name: `${groom} & ${bride} are getting married`,
    short_name: `${groom} & ${bride}`,
    description: wedding.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#e8f4fa",
    theme_color: "#7dc9e8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
