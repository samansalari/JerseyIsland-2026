import Firecrawl from "@mendable/firecrawl-js";

/**
 * VotePulse — Shared Firecrawl Utility
 *
 * Centralised client, retry logic, credit tracking, and typed wrappers
 * so individual scrapers stay clean.
 *
 * Usage:
 *   import { scrapeUrl, batchScrapeUrls, mapSite, getCreditsUsed } from "@/lib/firecrawl";
 *
 * For scripts outside src/ (scripts/scrapers/*), import with a relative path:
 *   import { scrapeUrl, ... } from "../../src/lib/firecrawl";
 */

// ── Config ──────────────────────────────────────────────────────────────────

const RETRY_DELAY_MS = 5000;
const DEFAULT_SCRAPE_TIMEOUT_MS = 60_000;
const DEFAULT_BATCH_TIMEOUT_MS = 600_000;
const DEFAULT_MAP_TIMEOUT_MS = 120_000;
const DAILY_CREDIT_WARN_THRESHOLD =
  Number(process.env.FIRECRAWL_DAILY_CREDIT_LIMIT) || 500;

// ── Bootstrap ───────────────────────────────────────────────────────────────

const apiKey = process.env.FIRECRAWL_API_KEY;
if (!apiKey) {
  throw new Error(
    "[firecrawl] FIRECRAWL_API_KEY is not set. Add it to .env.local.",
  );
}

const client = new Firecrawl({ apiKey });

// ── Types ───────────────────────────────────────────────────────────────────

export type ScrapedPage = {
  url: string;
  markdown: string;
  title: string | null;
  sourceUrl: string;
  scrapedAt: Date;
};

export type ScrapeOptions = {
  formats?: ("markdown" | "html" | "rawHtml" | "links" | "screenshot")[];
  timeout?: number;
};

export class FirecrawlError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "FirecrawlError";
  }
}

// ── Credit tracking ─────────────────────────────────────────────────────────

let _creditsUsed = 0;

export function getCreditsUsed(): number {
  return _creditsUsed;
}

export function resetCreditCounter(): void {
  _creditsUsed = 0;
}

function trackCredit(n = 1) {
  _creditsUsed += n;
  if (_creditsUsed >= DAILY_CREDIT_WARN_THRESHOLD) {
    console.warn(
      `[firecrawl] ⚠ Daily credit usage (${_creditsUsed}) exceeds threshold (${DAILY_CREDIT_WARN_THRESHOLD})`,
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function toScrapedPage(data: any): ScrapedPage {
  return {
    url: data.metadata?.sourceURL || data.metadata?.url || "",
    markdown: data.markdown ?? "",
    title: data.metadata?.title ?? null,
    sourceUrl: data.metadata?.sourceURL || data.metadata?.url || "",
    scrapedAt: new Date(),
  };
}

// ── scrapeUrl ───────────────────────────────────────────────────────────────

/**
 * Scrape a single URL with one retry on failure.
 */
export async function scrapeUrl(
  url: string,
  options?: ScrapeOptions,
): Promise<ScrapedPage> {
  const formats = options?.formats ?? ["markdown"];
  const timeout = options?.timeout ?? DEFAULT_SCRAPE_TIMEOUT_MS;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await withTimeout(
        client.scrapeUrl(url, { formats }),
        timeout,
        `Scrape ${url}`,
      );

      if (!result.success) {
        throw new FirecrawlError(
          `Scrape returned unsuccessful: ${JSON.stringify(result)}`,
          url,
        );
      }

      if (!result.markdown && formats.includes("markdown")) {
        throw new FirecrawlError("Scrape returned empty markdown", url);
      }

      trackCredit();
      return toScrapedPage(result);
    } catch (err) {
      if (attempt === 0 && !(err instanceof FirecrawlError && err.statusCode === 402)) {
        console.warn(
          `[firecrawl] Attempt 1 failed for ${url}: ${err instanceof Error ? err.message : err}`,
        );
        console.warn(`[firecrawl] Retrying in ${RETRY_DELAY_MS / 1000}s…`);
        await sleep(RETRY_DELAY_MS);
      } else {
        if (err instanceof FirecrawlError) throw err;
        throw new FirecrawlError(
          err instanceof Error ? err.message : String(err),
          url,
        );
      }
    }
  }

  throw new FirecrawlError("Unreachable", url);
}

// ── batchScrapeUrls ─────────────────────────────────────────────────────────

/**
 * Batch-scrape multiple URLs. The SDK handles polling internally.
 * Returns results in the same order as input (best effort — some may fail).
 */
export async function batchScrapeUrls(
  urls: string[],
  options?: ScrapeOptions,
): Promise<ScrapedPage[]> {
  if (urls.length === 0) return [];

  const formats = options?.formats ?? ["markdown"];
  const timeout = options?.timeout ?? DEFAULT_SCRAPE_TIMEOUT_MS;

  console.log(`[firecrawl] Batch scrape: ${urls.length} URLs…`);
  const startTime = Date.now();

  const result = await withTimeout(
    client.batchScrapeUrls(urls, { formats }),
    timeout,
    `Batch scrape (${urls.length} URLs)`,
  );

  if (!result.success) {
    throw new FirecrawlError(
      `Batch scrape failed: ${JSON.stringify(result)}`,
      urls[0] ?? "batch",
    );
  }

  const pages: ScrapedPage[] = (result.data ?? []).map(toScrapedPage);

  trackCredit(pages.length);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(
    `[firecrawl] Batch scrape complete: ${pages.length}/${urls.length} pages (${elapsed}s, ${pages.length} credits)`,
  );

  return pages;
}

// ── mapSite ─────────────────────────────────────────────────────────────────

/**
 * Map a site to discover URLs. Returns the raw link array.
 */
export async function mapSite(url: string): Promise<string[]> {
  console.log(`[firecrawl] Mapping ${url}…`);

  const result = await withTimeout(
    client.mapUrl(url),
    DEFAULT_MAP_TIMEOUT_MS,
    `Map ${url}`,
  );

  if (!result.success || !result.links || result.links.length === 0) {
    throw new FirecrawlError(
      `Map returned 0 results: ${JSON.stringify(result)}`,
      url,
    );
  }

  console.log(`[firecrawl] Mapped ${result.links.length} URLs`);
  return result.links;
}

// ── scrapePdf ───────────────────────────────────────────────────────────────

/**
 * Scrape a PDF URL and extract markdown text.
 */
export async function scrapePdf(url: string): Promise<ScrapedPage> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await withTimeout(
        client.scrapeUrl(url, {
          formats: ["markdown"],
          // @ts-expect-error — parsers option exists but may not be in SDK types yet
          parsers: [{ type: "pdf", mode: "auto" }],
        }),
        DEFAULT_SCRAPE_TIMEOUT_MS,
        `PDF scrape ${url}`,
      );

      if (!result.success || !result.markdown) {
        throw new FirecrawlError(
          `PDF scrape failed or returned empty: ${JSON.stringify(result)}`,
          url,
        );
      }

      trackCredit();
      return toScrapedPage(result);
    } catch (err) {
      if (attempt === 0) {
        console.warn(
          `[firecrawl] PDF scrape attempt 1 failed for ${url}: ${err instanceof Error ? err.message : err}`,
        );
        await sleep(RETRY_DELAY_MS);
      } else {
        if (err instanceof FirecrawlError) throw err;
        throw new FirecrawlError(
          err instanceof Error ? err.message : String(err),
          url,
        );
      }
    }
  }

  throw new FirecrawlError("Unreachable", url);
}

// ── Re-export client for advanced use ───────────────────────────────────────

export { client as firecrawlClient };
