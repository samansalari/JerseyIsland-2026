import type { Metadata } from "next";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { asc } from "drizzle-orm";
import { CandidateGrid } from "./candidate-grid";
import { buildPublicPageMetadata } from "@/lib/seo";

export const revalidate = 21600; // 6 hours

export const metadata: Metadata = buildPublicPageMetadata({
  titleSegment: "Candidates",
  description:
    "Browse every candidate for Jersey’s 2026 general election: parish, party, AI summaries with source links, and links to full profiles.",
  path: "/candidates",
});

/** Subset of candidate fields the listing page needs. */
export type CandidateCard = {
  slug: string;
  name: string;
  district: string;
  party: string | null;
  photoUrl: string | null;
  aiSummary: string | null;
};

async function getCandidates(): Promise<CandidateCard[]> {
  try {
    return await db
      .select({
        slug: candidates.slug,
        name: candidates.name,
        district: candidates.district,
        party: candidates.party,
        photoUrl: candidates.photoUrl,
        aiSummary: candidates.aiSummary,
      })
      .from(candidates)
      .orderBy(asc(candidates.name));
  } catch {
    return [];
  }
}

export default async function CandidatesPage() {
  const all = await getCandidates();

  // Derive filter options from the data.
  const districts = [...new Set(all.map((c) => c.district))].sort();
  const parties = [
    ...new Set(all.map((c) => c.party).filter(Boolean) as string[]),
  ].sort();

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-14">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-navy md:text-[34px]">
          Candidates
        </h1>
        <p className="mt-2 max-w-lg text-[14px] text-muted-foreground">
          {all.length} candidates standing across Jersey&rsquo;s parishes.
          Filter by district, party, or search by name.
        </p>
      </header>

      <CandidateGrid
        candidates={all}
        districts={districts}
        parties={parties}
      />
    </main>
  );
}
