import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The API routes read the synthetic data files at run time.
  outputFileTracingIncludes: {
    "/api/ask": ["./data/**"],
    "/api/tts": ["./data/**"],
  },
};

export default nextConfig;
