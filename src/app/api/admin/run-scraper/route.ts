import { existsSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mergeCronState, type ScraperResult } from "@/lib/admin-cron-state";
import { runRepoScript } from "@/lib/admin-exec";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const maxDuration = 600;

const SCRIPTS: Record<string, string> = {
  flow_je: "scripts/scrapers/scrape-flow-je.ts",
  vote_je: "scripts/scrapers/scrape-vote-je.ts",
  policy_je: "scripts/scrapers/scrape-policy-je.ts",
  ingest_news: "scripts/ingest-news.ts",
  enrich_articles: "scripts/enrich-articles.ts",
};

const Body = z.object({
  scraperName: z.enum([
    "flow_je",
    "vote_je",
    "policy_je",
    "ingest_news",
    "enrich_articles",
  ]),
});

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { scraperName } = parsed.data;
  const script = SCRIPTS[scraperName];
  if (!script || !existsSync(script)) {
    return NextResponse.json(
      { error: `Scraper "${scraperName}" is not available (missing script).` },
      { status: 400 },
    );
  }

  const outcome = await runRepoScript(script);
  const now = new Date().toISOString();
  const result: ScraperResult = outcome.ok ? "success" : "fail";

  if (scraperName === "flow_je") {
    mergeCronState({
      lastScrape: { flow_je: now },
      lastScrapeResult: { flow_je: result },
    });
  } else if (scraperName === "vote_je") {
    mergeCronState({
      lastScrape: { vote_je: now },
      lastScrapeResult: { vote_je: result },
    });
  } else if (scraperName === "policy_je") {
    mergeCronState({
      lastScrape: { policy_je: now },
      lastScrapeResult: { policy_je: result },
    });
  } else if (scraperName === "ingest_news") {
    mergeCronState({
      lastNewsIngest: now,
      lastNewsIngestResult: result,
    });
  } else if (scraperName === "enrich_articles") {
    mergeCronState({
      lastArticleEnrichment: now,
      lastEnrichArticlesResult: result,
    });
  }

  return NextResponse.json({
    ok: outcome.ok,
    durationSec: outcome.durationSec,
    outputTail: outcome.output.split("\n").slice(-40).join("\n"),
  });
}
