import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, topicSummaries } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VALID_ISSUES = new Set([
  "housing",
  "healthcare",
  "tax",
  "education",
  "environment",
  "transport",
  "cost_of_living",
  "immigration",
  "economy",
  "public_services",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ issue: string }> },
) {
  const { issue } = await params;

  if (!VALID_ISSUES.has(issue)) {
    return NextResponse.json({ error: "Invalid issue" }, { status: 400 });
  }

  try {
    const [summary] = await db
      .select({
        aiSummary: topicSummaries.aiSummary,
        candidateCount: topicSummaries.candidateCount,
        topParties: topicSummaries.topParties,
        sourcesCited: topicSummaries.sourcesCited,
        themeClusters: topicSummaries.themeClusters,
        icon: topicSummaries.icon,
        displayName: topicSummaries.displayName,
        generatedAt: topicSummaries.generatedAt,
      })
      .from(topicSummaries)
      .where(eq(topicSummaries.issue, issue))
      .limit(1);

    const allCandidates = await db
      .select({
        name: candidates.name,
        slug: candidates.slug,
        district: candidates.district,
        party: candidates.party,
        aiIssues: candidates.aiIssues,
        manifestoUrl: candidates.manifestoUrl,
      })
      .from(candidates)
      .where(and(isNotNull(candidates.aiIssues), eq(candidates.is2026, true)));

    type CandidateWithPosition = {
      name: string;
      slug: string;
      district: string;
      party: string | null;
      position: string;
      sourceQuote: string;
      confidence: number;
      manifestoUrl: string | null;
    };

    const candidatesWithPosition: CandidateWithPosition[] = [];

    for (const candidate of allCandidates) {
      const issues = Array.isArray(candidate.aiIssues)
        ? (candidate.aiIssues as Array<{
            issue: string;
            position: string;
            source_quote: string;
            confidence: number;
          }>)
        : [];
      const issueData = issues.find((i) => i.issue === issue);

      if (issueData && issueData.confidence >= 0.4) {
        candidatesWithPosition.push({
          name: candidate.name,
          slug: candidate.slug,
          district: candidate.district,
          party: candidate.party,
          position: issueData.position,
          sourceQuote: issueData.source_quote,
          confidence: issueData.confidence,
          manifestoUrl: candidate.manifestoUrl,
        });
      }
    }

    candidatesWithPosition.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      issue,
      summary: summary ?? null,
      themeClusters: summary?.themeClusters ?? [],
      candidates: candidatesWithPosition,
      total: candidatesWithPosition.length,
    });
  } catch (err) {
    console.error("[Topic API]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
