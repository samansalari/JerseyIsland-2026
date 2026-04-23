import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const logsDir = () => join(process.cwd(), "logs");
export const cronStatePath = () => join(logsDir(), "cron-state.json");
export const warningsLogPath = () => join(logsDir(), "warnings.log");

export type ScraperResult = "success" | "fail" | null;

export type CronStateFile = {
  lastScrape: {
    flow_je: string | null;
    vote_je: string | null;
    policy_je: string | null;
  };
  lastScrapeResult: {
    flow_je: ScraperResult;
    vote_je: ScraperResult;
    policy_je: ScraperResult;
  };
  lastEnrichment: string | null;
  lastEnrichmentResult: ScraperResult;
  lastNewsIngest: string | null;
  lastNewsIngestResult: ScraperResult;
  lastEnrichArticlesResult: ScraperResult;
  /** ISO time of last `enrich-articles` run (cron or manual). */
  lastArticleEnrichment: string | null;
  firecrawlCreditsToday: number;
  warningsLast24h: number;
  creditResetDate: string;
};

export function defaultCronState(): CronStateFile {
  return {
    lastScrape: { flow_je: null, vote_je: null, policy_je: null },
    lastScrapeResult: { flow_je: null, vote_je: null, policy_je: null },
    lastEnrichment: null,
    lastEnrichmentResult: null,
    lastNewsIngest: null,
    lastNewsIngestResult: null,
    lastEnrichArticlesResult: null,
    lastArticleEnrichment: null,
    firecrawlCreditsToday: 0,
    warningsLast24h: 0,
    creditResetDate: new Date().toISOString().slice(0, 10),
  };
}

export type CronStatePatch = {
  lastScrape?: Partial<CronStateFile["lastScrape"]>;
  lastScrapeResult?: Partial<CronStateFile["lastScrapeResult"]>;
  lastEnrichment?: string | null;
  lastEnrichmentResult?: ScraperResult;
  lastNewsIngest?: string | null;
  lastNewsIngestResult?: ScraperResult;
  lastEnrichArticlesResult?: ScraperResult;
  lastArticleEnrichment?: string | null;
  firecrawlCreditsToday?: number;
  warningsLast24h?: number;
  creditResetDate?: string;
};

function mergeDeep(base: CronStateFile, raw: CronStatePatch): CronStateFile {
  return {
    ...base,
    ...raw,
    lastScrape: { ...base.lastScrape, ...raw.lastScrape },
    lastScrapeResult: { ...base.lastScrapeResult, ...raw.lastScrapeResult },
    lastEnrichment: raw.lastEnrichment ?? base.lastEnrichment,
    lastEnrichmentResult: raw.lastEnrichmentResult ?? base.lastEnrichmentResult,
    lastNewsIngest: raw.lastNewsIngest ?? base.lastNewsIngest,
    lastNewsIngestResult: raw.lastNewsIngestResult ?? base.lastNewsIngestResult,
    lastEnrichArticlesResult:
      raw.lastEnrichArticlesResult ?? base.lastEnrichArticlesResult,
    lastArticleEnrichment:
      raw.lastArticleEnrichment ?? base.lastArticleEnrichment,
    firecrawlCreditsToday: raw.firecrawlCreditsToday ?? base.firecrawlCreditsToday,
    warningsLast24h: raw.warningsLast24h ?? base.warningsLast24h,
    creditResetDate: raw.creditResetDate ?? base.creditResetDate,
  };
}

export function readCronState(): CronStateFile {
  mkdirSync(logsDir(), { recursive: true });
  const path = cronStatePath();
  if (!existsSync(path)) return defaultCronState();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as CronStatePatch;
    return mergeDeep(defaultCronState(), raw);
  } catch {
    return defaultCronState();
  }
}

export function mergeCronState(partial: CronStatePatch): CronStateFile {
  const next = mergeDeep(readCronState(), partial);
  mkdirSync(logsDir(), { recursive: true });
  writeFileSync(cronStatePath(), JSON.stringify(next, null, 2));
  return next;
}

export function readWarningsTail(maxLines = 80): string[] {
  const p = warningsLogPath();
  if (!existsSync(p)) return [];
  try {
    const lines = readFileSync(p, "utf8").split("\n").filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}
