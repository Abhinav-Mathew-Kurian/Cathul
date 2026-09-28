import type { MetadataRoute } from "next";
import { wedding } from "@/content/wedding";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: wedding.siteUrl, changeFrequency: "weekly", priority: 1 }];
}
