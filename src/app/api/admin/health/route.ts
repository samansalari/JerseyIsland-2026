import { NextRequest, NextResponse } from "next/server";
import { isNotNull, isNull, count } from "drizzle-orm";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { candidates, articles } from "@/db/schema";
import { readCronState, readWarningsTail } from "@/lib/admin-cron-state";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const cron = readCronState();
  const warnings = readWarningsTail(100);

  try {
    const [totalCandidates] = await db.select({ n: count() }).from(candidates);
    const [enrichedCandidates] = await db
      .select({ n: count() })
      .from(candidates)
      .where(isNotNull(candidates.aiSummary));
    const [withManifesto] = await db
      .select({ n: count() })
      .from(candidates)
      .where(isNotNull(candidates.manifestoRaw));

    const [totalArticles] = await db.select({ n: count() }).from(articles);
    const [enrichedArticles] = await db
      .select({ n: count() })
      .from(articles)
      .where(isNotNull(articles.aiSummary));

    const candidateRows = await db
      .select({
        id: candidates.id,
        slug: candidates.slug,
        name: candidates.name,
        district: candidates.district,
        party: candidates.party,
        manifestoRaw: candidates.manifestoRaw,
        aiSummary: candidates.aiSummary,
        lastEnrichedAt: candidates.lastEnrichedAt,
      })
      .from(candidates)
      .orderBy(asc(candidates.name));

    return NextResponse.json({
      candidateStats: {
        total: totalCandidates?.n ?? 0,
        enriched: enrichedCandidates?.n ?? 0,
        withManifesto: withManifesto?.n ?? 0,
      },
      articles: {
        total: totalArticles?.n ?? 0,
        enriched: enrichedArticles?.n ?? 0,
      },
      cron: {
        lastScrape: cron.lastScrape,
        lastScrapeResult: cron.lastScrapeResult,
        lastEnrichment: cron.lastEnrichment,
        lastEnrichmentResult: cron.lastEnrichmentResult,
        lastNewsIngest: cron.lastNewsIngest,
        lastNewsIngestResult: cron.lastNewsIngestResult,
        lastEnrichArticlesResult: cron.lastEnrichArticlesResult,
        lastArticleEnrichment: cron.lastArticleEnrichment,
        firecrawlCreditsToday: cron.firecrawlCreditsToday,
        warningsLast24h: cron.warningsLast24h,
      },
      warnings,
      candidates: candidateRows.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        district: c.district,
        party: c.party,
        hasManifesto: !!c.manifestoRaw,
        hasSummary: !!c.aiSummary,
        lastEnrichedAt: c.lastEnrichedAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: message,
        cron,
        warnings,
      },
      { status: 503 },
    );
  }
}
