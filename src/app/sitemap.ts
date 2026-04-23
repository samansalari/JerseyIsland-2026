import type { MetadataRoute } from "next";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { asc } from "drizzle-orm";

function siteBase() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

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
    const rows = await db
      .select({
        slug: candidates.slug,
        updatedAt: candidates.updatedAt,
      })
      .from(candidates)
      .orderBy(asc(candidates.slug));

    const candidateEntries: MetadataRoute.Sitemap = rows.map((r) => ({
      url: `${base}/candidates/${encodeURIComponent(r.slug)}`,
      lastModified: r.updatedAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    }));

    return [...staticEntries, ...candidateEntries];
  } catch {
    return staticEntries;
  }
}
