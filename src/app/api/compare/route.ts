import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  if (!ids.every((id) => UUID_RE.test(id))) {
    return NextResponse.json(
      { error: "Invalid candidate id format" },
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
        bio: candidates.bio,
        photoUrl: candidates.photoUrl,
        aiSummary: candidates.aiSummary,
        aiIssues: candidates.aiIssues,
        manifestoUrl: candidates.manifestoUrl,
        sourceUrls: candidates.sourceUrls,
        manifestoRaw: candidates.manifestoRaw,
      })
      .from(candidates)
      .where(and(inArray(candidates.id, ids), eq(candidates.is2026, true)));

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
