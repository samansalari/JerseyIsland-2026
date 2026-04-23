import type { MetadataRoute } from "next";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { asc, ne } from "drizzle-orm";
import { siteBase } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBase();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: `${base}/candidates`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${base}/compare`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${base}/districts`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/trends`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.75,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.55,
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
      url: `${base}/candidates/${encodeURIComponent(r.slug)}`,
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
      url: `${base}/districts/${encodeURIComponent(d)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    return [...staticEntries, ...candidateEntries, ...districtEntries];
  } catch {
    return staticEntries;
  }
}
