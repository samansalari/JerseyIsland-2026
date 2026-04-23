import path from "node:path";
import type { NextConfig } from "next";

function supabaseImageHost(): { protocol: "https"; hostname: string }[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw?.trim()) return [];
  try {
    const { hostname } = new URL(raw);
    if (hostname) return [{ protocol: "https", hostname }];
  } catch {
    /* ignore */
  }
  return [];
}

const nextConfig: NextConfig = {
  // Railway: standard Node server (do not set output: "export" here).
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname),
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "flow.je" },
      { protocol: "https", hostname: "vote.je" },
      { protocol: "https", hostname: "www.vote.je" },
      { protocol: "https", hostname: "policy.je" },
      ...supabaseImageHost(),
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/candidates/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
