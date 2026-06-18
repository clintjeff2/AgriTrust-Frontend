import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "recharts",
      "leaflet",
      "d3",
    ],
  },
};

export default nextConfig;
