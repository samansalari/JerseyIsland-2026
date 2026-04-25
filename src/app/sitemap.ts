import type { MetadataRoute } from "next";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { asc, ne } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://votepulse.je";
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/candidates`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/compare`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/trends`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/districts`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  try {
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

    const candidateEntries: MetadataRoute.Sitemap = candidateRows.map((r) => ({
      url: `${siteUrl}/candidates/${r.slug}`,
      lastModified: r.lastEnrichedAt ?? r.updatedAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }));

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
    return staticEntries;
  }
}
