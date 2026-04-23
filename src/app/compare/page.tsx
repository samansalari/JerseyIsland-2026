import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { buildPublicPageMetadata } from "@/lib/seo";
import { CompareClient } from "./compare-client";

export const revalidate = 21600;
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPublicPageMetadata({
  titleSegment: "Compare candidates",
  description:
    "Compare Jersey 2026 candidates side by side on housing, tax, healthcare, and the full issue set - with source quotes and confidence where AI extracted positions.",
  path: "/compare",
});

async function getData() {
  try {
    const allCandidates = await db
      .select({
        id: candidates.id,
        name: candidates.name,
        slug: candidates.slug,
        district: candidates.district,
        party: candidates.party,
        photo_url: candidates.photoUrl,
      })
      .from(candidates)
      .orderBy(asc(candidates.name));

    const districts = [...new Set(allCandidates.map((candidate) => candidate.district))]
      .filter(Boolean)
      .sort();

    return { allCandidates, districts };
  } catch {
    return { allCandidates: [], districts: [] as string[] };
  }
}

export default async function ComparePage() {
  const { allCandidates, districts } = await getData();
  return <CompareClient allCandidates={allCandidates} districts={districts} />;
}
