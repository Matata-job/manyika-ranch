import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Bundle Sept 2025 camp JSON + import helpers for OWNER apply on Vercel
  outputFileTracingIncludes: {
    "/api/admin/import-camps": [
      "./data/imports/**/*",
      "./scripts/import-camps/**/*",
    ],
  },
};

export default withSerwist(nextConfig);
