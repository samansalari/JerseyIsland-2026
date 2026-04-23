import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ISR + RSC defaults. Individual routes opt in with `export const revalidate = N`.
  experimental: {
    // Keep server actions bounded; election data payloads are small.
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "flow.je" },
      { protocol: "https", hostname: "vote.je" },
      { protocol: "https", hostname: "policy.je" },
    ],
  },
};

export default nextConfig;
