import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server's JS/hot-reload assets load through an ngrok tunnel —
  // without this, pages render but nothing is interactive (dev-only).
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.io", "*.ngrok.app"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "plus.unsplash.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
