import type { NextConfig } from "next";

// Aplikasi ini sepenuhnya dinamis (data per-user dari Supabase), jadi
// Cache Components tidak diaktifkan. Paket biner (ffmpeg, sharp) hanya
// dipakai di server/worker.
const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "ffmpeg-static", "ffprobe-static"],
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
