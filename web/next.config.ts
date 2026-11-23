import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The API routes read the synthetic data files at run time.
  outputFileTracingIncludes: {
    "/api/ask": ["./data/**"],
    "/api/tts": ["./data/**"],
  },
  // Security headers on every page and API response (lib/security-headers.ts).
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV !== "production") }];
  },
};

export default nextConfig;
