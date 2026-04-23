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
};

export default nextConfig;
