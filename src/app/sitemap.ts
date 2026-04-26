import type { MetadataRoute } from "next";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { asc, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // regenerate sitemap every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://votepulse.je";
  const now = new Date();

  // ── Static pages ──────────────────────────────────────────────────────────
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/candidates`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/trends`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/compare`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/districts`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/how-it-works`,
      lastModified: new Date('2026-04-27'),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  try {
    // ── Candidate pages ─────────────────────────────────────────────────────
    // Uses camelCase Drizzle field names (lastEnrichedAt, updatedAt, slug, district)
    // Only includes candidates with a real district (excludes 'Unknown' imports)
    const candidateRows = await db
      .select({
        slug: candidates.slug,
        updatedAt: candidates.updatedAt,
        lastEnrichedAt: candidates.lastEnrichedAt,
        district: candidates.district,
      })
      .from(candidates)
      .where(ne(candidates.district, "Unknown"))
      .orderBy(asc(candidates.slug));

    // priority: 0.8, changeFrequency: 'daily' as required
    // lastmod uses real DB timestamp so Google sees accurate freshness signal
    const candidateEntries: MetadataRoute.Sitemap = candidateRows.map((r) => ({
      url: `${siteUrl}/candidates/${r.slug}`,
      lastModified: r.lastEnrichedAt ?? r.updatedAt ?? now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

    // ── District pages ──────────────────────────────────────────────────────
    // Deduplicated from live DB query — never hardcoded
    const districts = [
      ...new Set(
        candidateRows
          .map((c) => c.district)
          .filter((d): d is string => Boolean(d && d !== "Unknown")),
      ),
    ].sort();

    const districtEntries: MetadataRoute.Sitemap = districts.map((d) => ({
      url: `${siteUrl}/districts/${encodeURIComponent(d)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    return [...staticEntries, ...candidateEntries, ...districtEntries];
  } catch {
    // Fallback to static pages only if DB is unreachable (build time / CI)
    return staticEntries;
  }
}
