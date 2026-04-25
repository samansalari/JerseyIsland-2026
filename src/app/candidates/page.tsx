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

        {/* AEO answer capsule — structured for Google AI Overviews extraction */}
        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-muted-foreground">
          The <strong className="text-navy font-semibold">Jersey 2026 General Election</strong>{" "}
          takes place on{" "}
          <strong className="text-navy font-semibold">7 June 2026</strong>.
          VotePulse tracks{" "}
          <strong className="text-navy font-semibold">
            {all.length > 0 ? all.length : 135} declared candidates
          </strong>{" "}
          standing across{" "}
          <strong className="text-navy font-semibold">
            14 parishes and electoral districts
          </strong>{" "}
          for the roles of Senator (island-wide), Deputy (district), and
          Connétable (parish). AI-extracted policy positions cover housing,
          healthcare, cost of living, economy, environment and more. Filter by
          district or search by name below.
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
