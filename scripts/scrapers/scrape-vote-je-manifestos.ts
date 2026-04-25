/**
 * VotePulse — vote.je Manifesto Scraper
 *
 * When vote.je publishes 2026 candidate manifesto pages, this script:
 *  1. Maps vote.je to discover 2026 candidate profile URLs.
 *  2. Scrapes each page with Firecrawl.
 *  3. Fuzzy-matches the candidate name to existing DB records.
 *  4. Updates manifesto_raw when new content is meaningfully longer/different.
 *  5. Clears ai_summary + last_enriched_at to trigger re-enrichment.
 *
 * Usage:
 *   npx tsx scripts/scrapers/scrape-vote-je-manifestos.ts
 *   npx tsx scripts/scrapers/scrape-vote-je-manifestos.ts --dry-run
 *
 * Requires: FIRECRAWL_API_KEY, DATABASE_URL in .env.local
 */

const { config } = await import("dotenv");
config({ path: ".env.local" });

import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { candidates, snapshots } from "../../src/db/schema";
import { mapSite, scrapeUrl } from "../../src/lib/firecrawl";

// ── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = "https://www.vote.je";
const RATE_LIMIT_MS = 1500;

const DATABASE_URL = process.env.DATABASE_URL;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!DATABASE_URL) {
  console.error("[manifestos] ✗ DATABASE_URL not set");
  process.exit(1);
}
if (!FIRECRAWL_API_KEY) {
  console.error("[manifestos] ✗ FIRECRAWL_API_KEY not set");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
if (DRY_RUN) console.log("[manifestos] ── DRY RUN MODE ──\n");

const pgClient = postgres(DATABASE_URL, { max: 3, idle_timeout: 20, prepare: false });
const db = drizzle(pgClient, { schema: { candidates, snapshots } });

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalise a name string for fuzzy matching:
 * strip accents, lowercase, keep only letters and spaces.
 */
function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (na === nb) return true;

  const ta = na.split(" ");
  const tb = nb.split(" ");
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (shorter.every((t) => longer.includes(t))) return true;

  if (
    ta.length >= 2 &&
    tb.length >= 2 &&
    ta[0] === tb[0] &&
    ta[ta.length - 1] === tb[tb.length - 1]
  ) {
    return true;
  }

  return false;
}

/**
 * Try to extract the primary candidate name from a scraped page.
 * Looks for the first h1/h2 heading that looks like a person name.
 */
function extractCandidateName(markdown: string): string | null {
  for (const line of markdown.split("\n")) {
    const m = line.match(/^#{1,3}\s+(.+)/);
    if (!m) continue;
    const candidate = m[1]
      .replace(/\*\*/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
    if (
      /^[A-Za-zÀ-ÿ\s'\-.]{3,60}$/.test(candidate) &&
      candidate.split(/\s+/).length >= 2 &&
      candidate.split(/\s+/).length <= 6
    ) {
      return candidate.replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

// ── Filter: which URLs are 2026 manifesto pages? ─────────────────────────────

function is2026ManifestoUrl(url: string): boolean {
  if (!url.includes("vote.je")) return false;
  if (url.endsWith("/") || url.includes("#") || url.includes("?page="))
    return false;

  // Primary: explicit 2026 path segment
  if (url.includes("/2026/")) return true;

  // Candidate/profile paths (vote.je may use these for 2026 profiles)
  if (
    url.includes("/candidates/") ||
    url.includes("/candidate/") ||
    url.includes("/profile/") ||
    url.includes("/election/")
  ) {
    return true;
  }

  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log("[manifestos] Mapping vote.je for 2026 manifesto pages…");
  let allUrls: string[];
  try {
    allUrls = await mapSite(BASE_URL);
  } catch (err) {
    console.error("[manifestos] Map failed:", err instanceof Error ? err.message : err);
    console.log("[manifestos] vote.je may not have published 2026 pages yet. Exiting.");
    await pgClient.end({ timeout: 5 });
    return;
  }

  const manifestoUrls = [...new Set(allUrls.filter(is2026ManifestoUrl))];
  console.log(
    `[manifestos] Found ${manifestoUrls.length} potential 2026 manifesto pages`,
  );

  if (manifestoUrls.length === 0) {
    console.log(
      "[manifestos] No 2026 manifesto pages found yet. " +
      "Re-run after vote.je publishes the official list (expected ~27 April 2026).",
    );
    await pgClient.end({ timeout: 5 });
    return;
  }

  // Load existing candidates for fuzzy matching
  const allCandidates = await db.select().from(candidates);
  console.log(`[manifestos] Loaded ${allCandidates.length} existing DB candidates\n`);

  const stats = { scraped: 0, matched: 0, updated: 0, noMatch: 0, failed: 0 };

  for (const url of manifestoUrls) {
    console.log(`[manifestos] Scraping: ${url}`);

    let page;
    try {
      page = await scrapeUrl(url, { formats: ["markdown"] });
    } catch (err) {
      console.warn(`  ✗ Scrape failed: ${err instanceof Error ? err.message : err}`);
      stats.failed++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    stats.scraped++;

    if (!page.markdown || page.markdown.length < 100) {
      console.warn("  ⚠ Too short, skipping");
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const name = extractCandidateName(page.markdown);
    if (!name) {
      console.warn("  ⚠ Could not extract candidate name");
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const existing = allCandidates.find((c) => namesMatch(c.name, name));
    if (!existing) {
      console.log(`  ⚠ No DB match for: ${name}`);
      stats.noMatch++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    stats.matched++;

    const newLen = page.markdown.length;
    const existingLen = existing.manifestoRaw?.length ?? 0;
    const meaningfullyLonger = newLen > existingLen + 200;
    const hashChanged = sha256(page.markdown) !== (existing.dataHash ?? "");

    if (!meaningfullyLonger && !hashChanged) {
      console.log(`  = Unchanged: ${existing.name}`);
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    console.log(
      `  ✓ Updating: ${existing.name} (${newLen} chars, was ${existingLen})`,
    );

    if (!DRY_RUN) {
      // Snapshot previous state
      await db.insert(snapshots).values({
        entityType: "candidate",
        entityId: existing.id,
        data: {
          name: existing.name,
          manifesto_raw: existing.manifestoRaw,
          manifesto_url: existing.manifestoUrl,
          data_hash: existing.dataHash,
          source: "pre-vote-je-manifesto-update",
        },
      });

      await db
        .update(candidates)
        .set({
          manifestoRaw: page.markdown,
          manifestoUrl: url,
          dataHash: sha256(page.markdown),
          aiSummary: null,
          aiIssues: null,
          lastEnrichedAt: null,
          lastScrapedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, existing.id));

      stats.updated++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n[manifestos] ══════════════════════════════════════`);
  console.log(`[manifestos] Scraped  : ${stats.scraped}`);
  console.log(`[manifestos] Matched  : ${stats.matched}`);
  console.log(`[manifestos] Updated  : ${stats.updated}`);
  console.log(`[manifestos] No match : ${stats.noMatch}`);
  console.log(`[manifestos] Failed   : ${stats.failed}`);
  console.log(`[manifestos] Total    : ${elapsed}s`);
  if (DRY_RUN) console.log("[manifestos] (DRY RUN — no DB writes)");
  if (stats.updated > 0) {
    console.log("\n[manifestos] Run npm run enrich:batch to re-enrich updated candidates.");
  }

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[manifestos] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
