import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams
    .get("ids")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) ?? [];

  if (ids.length < 2 || ids.length > 4) {
    return NextResponse.json(
      { error: "Provide 2-4 candidate IDs" },
      { status: 400 },
    );
  }

  try {
    const results = await db
      .select({
        id: candidates.id,
        name: candidates.name,
        slug: candidates.slug,
        district: candidates.district,
        party: candidates.party,
        photo_url: candidates.photoUrl,
        ai_summary: candidates.aiSummary,
        ai_issues: candidates.aiIssues,
      })
      .from(candidates)
      .where(inArray(candidates.id, ids));

    const orderedResults = ids
      .map((id) => results.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is (typeof results)[number] => Boolean(candidate));

    return NextResponse.json({ candidates: orderedResults });
  } catch (error) {
    console.error("Compare API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch comparison data" },
      { status: 500 },
    );
  }
}
