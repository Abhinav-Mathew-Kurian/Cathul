import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server's JS/hot-reload assets load through an ngrok tunnel —
  // without this, pages render but nothing is interactive (dev-only).
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.io", "*.ngrok.app"],
  images: {
    // AVIF first — noticeably smaller than WebP for the big illustrated PNGs,
    // which matters on slow mobile data. Browsers without AVIF still get WebP.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "plus.unsplash.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
