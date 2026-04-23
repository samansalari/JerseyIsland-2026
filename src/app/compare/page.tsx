import type { Metadata } from "next";
import { db } from "@/db";
import { candidates, issues } from "@/db/schema";
import { asc } from "drizzle-orm";
import { CompareClient } from "./compare-client";
import { buildPublicPageMetadata } from "@/lib/seo";

export const revalidate = 21600;

export const metadata: Metadata = buildPublicPageMetadata({
  titleSegment: "Compare candidates",
  description:
    "Compare Jersey 2026 candidates side by side on housing, tax, healthcare, and the full issue set — with source quotes and confidence where AI extracted positions.",
  path: "/compare",
});

async function getData() {
  try {
    const [allCandidates, allIssues] = await Promise.all([
      db
        .select({
          slug: candidates.slug,
          name: candidates.name,
          district: candidates.district,
          party: candidates.party,
          photoUrl: candidates.photoUrl,
        })
        .from(candidates)
        .orderBy(asc(candidates.name)),
      db
        .select({
          id: issues.id,
          name: issues.name,
          displayName: issues.displayName,
          icon: issues.icon,
        })
        .from(issues)
        .orderBy(asc(issues.displayName)),
    ]);

    const districts = [...new Set(allCandidates.map((c) => c.district))].sort();

    return { allCandidates, allIssues, districts };
  } catch {
    return { allCandidates: [], allIssues: [], districts: [] as string[] };
  }
}

export default async function ComparePage() {
  const { allCandidates, allIssues, districts } = await getData();

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-14">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-navy md:text-[34px]">
          Compare Candidates
        </h1>
        <p className="mt-2 max-w-lg text-[14px] text-muted-foreground">
          Select 2–4 candidates to see where they stand on every issue,
          side by side. Positions are AI-extracted from manifestos with
          source quotes linked.
        </p>
      </header>

      <CompareClient
        allCandidates={allCandidates}
        allIssues={allIssues}
        districts={districts}
      />
    </main>
  );
}
