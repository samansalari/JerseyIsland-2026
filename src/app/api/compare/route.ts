import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, candidateIssues, issues } from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/compare?candidates=uuid1,uuid2,uuid3
 *
 * Returns candidates + their issue positions for the comparison matrix.
 * Accepts 2–4 candidate slugs (not UUIDs — friendlier for URLs).
 */
export async function GET(request: NextRequest) {
  const slugsParam = request.nextUrl.searchParams.get("candidates");

  if (!slugsParam) {
    return NextResponse.json(
      { error: "Missing ?candidates= query parameter" },
      { status: 400 },
    );
  }

  const slugs = slugsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (slugs.length < 2 || slugs.length > 4) {
    return NextResponse.json(
      { error: "Provide 2–4 candidate slugs, comma-separated" },
      { status: 400 },
    );
  }

  // 1. Fetch candidates
  const candidateRows = await db
    .select({
      id: candidates.id,
      slug: candidates.slug,
      name: candidates.name,
      district: candidates.district,
      party: candidates.party,
      photoUrl: candidates.photoUrl,
    })
    .from(candidates)
    .where(inArray(candidates.slug, slugs));

  if (candidateRows.length < 2) {
    return NextResponse.json(
      { error: "Could not find at least 2 of the requested candidates" },
      { status: 404 },
    );
  }

  const candidateIds = candidateRows.map((c) => c.id);

  // 2. Fetch all positions for these candidates
  const positions = await db
    .select({
      candidateId: candidateIssues.candidateId,
      issueId: candidateIssues.issueId,
      position: candidateIssues.position,
      sourceQuote: candidateIssues.sourceQuote,
      confidence: candidateIssues.confidence,
    })
    .from(candidateIssues)
    .where(inArray(candidateIssues.candidateId, candidateIds));

  // 3. Fetch all issues (so we show every row even if no candidate has data)
  const allIssues = await db
    .select({
      id: issues.id,
      name: issues.name,
      displayName: issues.displayName,
      icon: issues.icon,
    })
    .from(issues)
    .orderBy(asc(issues.displayName));

  return NextResponse.json({
    candidates: candidateRows,
    issues: allIssues,
    positions,
  });
}
