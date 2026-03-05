import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["mapbox-gl"],
  // Next.js 16 uses Turbopack by default - no webpack config needed
  turbopack: {},
};

export default nextConfig;
