import type { MetadataRoute } from "next";
import { wedding } from "@/content/wedding";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/wishes-admin", "/analytics-admin"] },
    sitemap: `${wedding.siteUrl}/sitemap.xml`,
  };
}
