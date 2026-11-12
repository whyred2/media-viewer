import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "@ffprobe-installer/ffprobe"],
  // Disable image optimization for API routes since we handle it with sharp
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
