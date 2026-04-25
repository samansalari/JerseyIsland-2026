import { desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { pulseInsights } from "@/db/schema";

export const dynamic = "force-dynamic";

/** DB-only: generation runs on the 6-hour cron (see `generatePulseInsight`). */
export async function GET() {
  const latest = await db
    .select()
    .from(pulseInsights)
    .where(
      inArray(pulseInsights.insightType, ["issue_summary", "issue_analysis"]),
    )
    .orderBy(desc(pulseInsights.generatedAt))
    .limit(1);

  if (!latest.length) {
    return NextResponse.json({ insight: null, generatedAt: null, sources: [] });
  }

  const row = latest[0]!;
  return NextResponse.json({
    insight: row.content,
    generatedAt: row.generatedAt,
    sources: row.sources ?? [],
  });
}
