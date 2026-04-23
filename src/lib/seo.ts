import type { Metadata } from "next";
import { env } from "@/lib/env";

export function siteBase(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

export function absoluteAssetUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteBase()}${p}`;
}

export function canonicalUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteBase()}${p}`;
}

const DEFAULT_OG_PATH = "/opengraph-image";

export function candidateMetadataTitle(name: string): string {
  return `${name} — VotePulse`;
}

export function truncateMetaDescription(
  text: string | null | undefined,
  max = 155,
): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export type PageSeoInput = {
  titleSegment: string;
  description: string;
  path: string;
  openGraphTitle?: string;
  ogImagePath?: string;
};

export function buildPublicPageMetadata(input: PageSeoInput): Metadata {
  const url = canonicalUrl(input.path);
  const fullTitle = `${input.titleSegment} | VotePulse`;
  const ogTitle = input.openGraphTitle ?? fullTitle;
  const ogPath = input.ogImagePath ?? DEFAULT_OG_PATH;
  const ogImageUrl = absoluteAssetUrl(ogPath);

  return {
    title: input.titleSegment,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description: input.description,
      url,
      type: "website",
      locale: "en_GB",
      siteName: "VotePulse",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "VotePulse — Jersey 2026 election intelligence",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: input.description,
      images: [ogImageUrl],
    },
    robots: { index: true, follow: true },
  };
}
