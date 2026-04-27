import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { candidateIssues, candidates, issues } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ district: string }> },
) {
  try {
    const { district: districtParam } = await params;
    const district = decodeURIComponent(districtParam);

    const districtCandidates = await db
      .select({
        id: candidates.id,
        name: candidates.name,
        slug: candidates.slug,
        district: candidates.district,
        party: candidates.party,
        bio: candidates.bio,
        ai_summary: candidates.aiSummary,
        manifesto_url: candidates.manifestoUrl,
      })
      .from(candidates)
      .where(and(eq(candidates.district, district), eq(candidates.is2026, true)))
      .orderBy(asc(candidates.name));

    if (!districtCandidates.length) {
      return NextResponse.json({ district, candidates: [], issues: [] });
    }

    const allIssues = await db
      .select({
        id: issues.id,
        name: issues.name,
        displayName: issues.displayName,
        icon: issues.icon,
      })
      .from(issues)
      .orderBy(asc(issues.name));

    const candidateIds = districtCandidates.map((candidate) => candidate.id);

    const issueData = await db
      .select({
        candidateId: candidateIssues.candidateId,
        issueId: candidateIssues.issueId,
        issueName: issues.name,
        issueDisplayName: issues.displayName,
        position: candidateIssues.position,
        sourceQuote: candidateIssues.sourceQuote,
        confidence: candidateIssues.confidence,
      })
      .from(candidateIssues)
      .innerJoin(issues, eq(candidateIssues.issueId, issues.id))
      .where(inArray(candidateIssues.candidateId, candidateIds));

    const issueMap: Record<string, Record<string, unknown>> = {};
    for (const row of issueData) {
      const candidateBucket = issueMap[row.candidateId] ?? {};
      candidateBucket[row.issueName] = row;
      issueMap[row.candidateId] = candidateBucket;
    }

    const enriched = districtCandidates.map((candidate) => ({
      ...candidate,
      issues: issueMap[candidate.id] || {},
      issueCount: Object.keys(issueMap[candidate.id] || {}).length,
    }));

    return NextResponse.json({
      district,
      candidates: enriched,
      issues: allIssues,
    });
  } catch (error) {
    console.error("District API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
