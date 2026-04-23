import Firecrawl from "@mendable/firecrawl-js";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import Parser from "rss-parser";
import { articles, candidates } from "../src/db/schema";

/**
 * VotePulse — News Ingestion Pipeline
 *
 * Parses RSS feeds → filters for new URLs → scrapes full articles via
 * Firecrawl → matches candidate mentions → inserts into articles table.
 * AI enrichment (summary, sentiment) is handled separately by enrich-articles.ts.
 *
 * Usage:
 *   npx tsx scripts/ingest-news.ts
 *   pnpm ingest:news
 *
 * Requires:
 *   FIRECRAWL_API_KEY and DATABASE_URL in .env.local
 */

// ── Feed config ─────────────────────────────────────────────────────────────

const FEEDS = [
  {
    name: "BBC Jersey",
    url: "https://feeds.bbci.co.uk/news/jersey/rss.xml",
  },
  // Add more feeds as you find them:
  // { name: "ITV Channel",       url: "FIND_AND_ADD_LATER" },
  // { name: "Bailiwick Express",  url: "FIND_AND_ADD_LATER" },
  // { name: "JEP",               url: "FIND_AND_ADD_LATER" },
] as const;

// ── Config ──────────────────────────────────────────────────────────────────

const SCRAPE_DELAY_MS = 1500;
const MAX_NEW_ARTICLES_WARN = 50;

// ── Bootstrap ───────────────────────────────────────────────────────────────

const { config } = await import("dotenv");
config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!DATABASE_URL) {
  console.error("[news] ✗ DATABASE_URL not set");
  process.exit(1);
}
if (!FIRECRAWL_API_KEY) {
  console.error("[news] ✗ FIRECRAWL_API_KEY not set");
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { articles, candidates } });
const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });
const rssParser = new Parser();

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Word-boundary name match. Avoids false positives like "Martin"
 * matching "St Martin" by requiring the full name as a phrase.
 */
function buildNameRegex(name: string): RegExp {
  // Escape regex special chars, then wrap in word boundaries
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

// ── Types ───────────────────────────────────────────────────────────────────

interface FeedItem {
  title: string;
  url: string;
  publishedAt: Date | null;
  feedName: string;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  // Load all candidates for name matching
  const allCandidates = await db
    .select({ id: candidates.id, name: candidates.name })
    .from(candidates);

  console.log(
    `[news] ${allCandidates.length} candidates loaded for mention matching`,
  );

  if (allCandidates.length === 0) {
    console.warn(
      "[news] ⚠ No candidates in DB — seed candidates first. Articles without mentions are skipped.",
    );
  }

  // Build name matchers
  const nameMatchers = allCandidates.map((c) => ({
    id: c.id,
    name: c.name,
    regex: buildNameRegex(c.name),
  }));

  // Load existing article URLs to skip duplicates
  const existingArticles = await db
    .select({ url: articles.url })
    .from(articles);
  const existingUrls = new Set(existingArticles.map((a) => a.url));

  console.log(`[news] ${existingUrls.size} existing articles in DB\n`);

  // ── Parse feeds ───────────────────────────────────────────────────────────

  const allItems: FeedItem[] = [];

  for (const feed of FEEDS) {
    if (feed.url.includes("FIND_AND_ADD_LATER")) {
      console.log(`[news] ${feed.name}: skipped (URL not configured)`);
      continue;
    }

    try {
      console.log(`[news] ${feed.name}: fetching RSS…`);
      const parsed = await rssParser.parseURL(feed.url);

      const items: FeedItem[] = (parsed.items ?? [])
        .filter((item) => item.link && item.title)
        .map((item) => ({
          title: item.title!.trim(),
          url: item.link!.trim(),
          publishedAt: item.pubDate ? new Date(item.pubDate) : null,
          feedName: feed.name,
        }));

      const newItems = items.filter((i) => !existingUrls.has(i.url));

      console.log(
        `[news] ${feed.name}: ${items.length} items in feed, ${newItems.length} new`,
      );

      allItems.push(...newItems);
    } catch (err) {
      console.error(
        `[news] ✗ ${feed.name}: feed parse failed — ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (allItems.length === 0) {
    console.log("\n[news] No new articles to process.");
    await pgClient.end({ timeout: 5 });
    return;
  }

  if (allItems.length > MAX_NEW_ARTICLES_WARN) {
    console.warn(
      `\n[news] ⚠ ${allItems.length} new articles is unusually high (>${MAX_NEW_ARTICLES_WARN}). Possible feed issue.`,
    );
  }

  console.log(`\n[news] Processing ${allItems.length} new article(s)…\n`);

  // ── Scrape + insert ───────────────────────────────────────────────────────

  let ingested = 0;
  let noMentions = 0;
  let scrapeFails = 0;
  let creditsUsed = 0;

  for (const item of allItems) {
    console.log(`[news] Scraping: "${item.title}"`);

    let markdown: string | null = null;

    try {
      const result = await firecrawl.scrapeUrl(item.url, {
        formats: ["markdown"],
      });

      if (result.success && result.markdown) {
        markdown = result.markdown;
        creditsUsed++;
      } else {
        console.warn(`  ⚠ Firecrawl returned no content for ${item.url}`);
        scrapeFails++;
        continue;
      }
    } catch (err) {
      console.warn(
        `  ⚠ Scrape failed: ${err instanceof Error ? err.message : err}`,
      );
      scrapeFails++;
      continue;
    }

    // Match candidates
    const mentionedIds: string[] = [];
    for (const matcher of nameMatchers) {
      if (matcher.regex.test(markdown)) {
        mentionedIds.push(matcher.id);
      }
    }

    const uniqueMentions = [...new Set(mentionedIds)];

    if (uniqueMentions.length === 0) {
      console.log(`  ⏭ No candidate mentions — skipping`);
      noMentions++;
      await sleep(SCRAPE_DELAY_MS);
      continue;
    }

    // Insert
    const contentHash = sha256(markdown);

    try {
      await db.insert(articles).values({
        title: item.title,
        source: item.feedName,
        url: item.url,
        publishedAt: item.publishedAt,
        contentRaw: markdown,
        contentHash,
        candidateMentions: uniqueMentions,
        // AI enrichment runs later
        aiSummary: null,
        aiSentiment: null,
      });

      const mentionNames = uniqueMentions
        .map((id) => allCandidates.find((c) => c.id === id)?.name ?? id)
        .join(", ");

      console.log(
        `  ✓ Ingested — ${uniqueMentions.length} mention(s): ${mentionNames}`,
      );
      ingested++;

      // Track URL so we don't re-process within this run
      existingUrls.add(item.url);
    } catch (err) {
      // Handle duplicate URL (race condition or re-run)
      if (
        err instanceof Error &&
        err.message.includes("unique") &&
        err.message.includes("url")
      ) {
        console.log(`  ⏭ Already exists (race condition) — skipping`);
      } else {
        console.error(
          `  ✗ Insert failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    await sleep(SCRAPE_DELAY_MS);
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[news] ══════════════════════════════════════`);
  console.log(`[news] Ingested:       ${ingested}`);
  console.log(`[news] No mentions:    ${noMentions}`);
  console.log(`[news] Scrape fails:   ${scrapeFails}`);
  console.log(`[news] Credits used:   ${creditsUsed}`);
  console.log(`[news] Total:          ${totalElapsed}s`);

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[news] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
