import { NextResponse } from "next/server";
import { pingDatabase } from "@/db";
import { db } from "@/db";
import { candidates, articles } from "@/db/schema";
import { isNotNull, isNull, count } from "drizzle-orm";
import { env } from "@/lib/env";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Always execute on request — this endpoint is the "truth" while the
// home page is ISR-cached.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();

  if (env.SKIP_DB_HEALTHCHECK) {
    return NextResponse.json(
      {
        status: "skipped",
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        database: "skipped",
        durationMs: Date.now() - startedAt,
      },
      { status: 200 },
    );
  }

  try {
    const res = await pingDatabase();
    const allTablesPresent = Object.values(res.tables).every(Boolean);

    // Candidate stats
    const [totalCandidates] = await db.select({ n: count() }).from(candidates);
    const [enrichedCandidates] = await db
      .select({ n: count() })
      .from(candidates)
      .where(isNotNull(candidates.aiSummary));
    const [withManifesto] = await db
      .select({ n: count() })
      .from(candidates)
      .where(isNotNull(candidates.manifestoRaw));

    // Article stats
    const [totalArticles] = await db.select({ n: count() }).from(articles);
    const [enrichedArticles] = await db
      .select({ n: count() })
      .from(articles)
      .where(isNotNull(articles.aiSummary));

    // Cron state (if cron.ts is running)
    let cronState: Record<string, unknown> | null = null;
    const stateFile = join(process.cwd(), "logs", "cron-state.json");
    if (existsSync(stateFile)) {
      try {
        cronState = JSON.parse(readFileSync(stateFile, "utf8"));
      } catch { /* ignore */ }
    }

    return NextResponse.json(
      {
        status: allTablesPresent ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        env: env.NODE_ENV,
        database: allTablesPresent ? "connected" : "degraded",
        db: {
          now: res.now,
          version: res.version,
          tables: res.tables,
          issueCount: res.issueCount,
        },
        candidates: {
          total: totalCandidates?.n ?? 0,
          enriched: enrichedCandidates?.n ?? 0,
          with_manifesto: withManifesto?.n ?? 0,
        },
        articles: {
          total: totalArticles?.n ?? 0,
          enriched: enrichedArticles?.n ?? 0,
        },
        ...(cronState
          ? {
              last_scrape: (cronState as any).lastScrape ?? null,
              last_enrichment: (cronState as any).lastEnrichment ?? null,
              firecrawl_credits_today:
                (cronState as any).firecrawlCreditsToday ?? 0,
              warnings_last_24h:
                (cronState as any).warningsLast24h ?? 0,
            }
          : {}),
        durationMs: Date.now() - startedAt,
      },
      { status: 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        database: "disconnected",
        message,
        durationMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
