import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/ai/generate",
        destination: "/api/ai/generate-v2",
      },
    ];
  },
};

export default nextConfig;
