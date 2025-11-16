import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbo: undefined, // 禁用 Turbopack
  },
};

export default nextConfig;
