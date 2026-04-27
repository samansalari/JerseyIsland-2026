/**
 * VotePulse — vote.je Manifesto Scraper
 *
 * Two-phase scraper for vote.je policy content.
 *
 * Phase 1 — 2026 manifestos (when vote.je publishes them):
 *   1. Maps vote.je for candidate profile URLs.
 *   2. Filters for likely 2026 manifesto pages.
 *   3. Scrapes each, fuzzy-matches the candidate name, and updates
 *      manifesto_raw + clears ai_summary so enrichment re-runs.
 *
 * Phase 2 — historical fallback (always runs):
 *   For any candidate whose `manifesto_raw` is empty OR is just flow.je
 *   boilerplate (election history with no real policy text), we:
 *     1. Re-scrape their flow.je profile (manifestoUrl) to discover
 *        historical vote.je URLs (e.g. /candidates/2016/{slug}/).
 *     2. Scrape the most recent historical vote.je page.
 *     3. Prepend a clear "[Historical manifesto from vote.je …]" note
 *        and write the result into manifesto_raw.
 *     4. Add the historical URL to source_urls.
 *     5. Clear ai_summary + last_enriched_at so enrichment re-runs and
 *        Grok can extract issue positions from the real policy text.
 *
 *   Phase 2 NEVER overwrites a manifesto that already contains 2026
 *   content (heuristic: substantive policy language).
 *
 * Usage:
 *   npm run scrape:manifestos
 *   npm run scrape:manifestos -- --dry-run
 *   npm run scrape:manifestos -- --candidate-slug=alvin-aaron
 *
 * Requires: FIRECRAWL_API_KEY, DATABASE_URL in .env.local
 */

import "../bootstrap-env";

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

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SLUG_FILTER = args
  .find((a) => a.startsWith("--candidate-slug="))
  ?.split("=")[1];

if (DRY_RUN) console.log("[manifestos] ── DRY RUN MODE ──\n");
if (SLUG_FILTER) console.log(`[manifestos] Filtering to slug: ${SLUG_FILTER}\n`);

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

// ── 2026 manifesto URL filter (Phase 1) ──────────────────────────────────────

function is2026ManifestoUrl(url: string): boolean {
  if (!url.includes("vote.je")) return false;
  if (url.endsWith("/") || url.includes("#") || url.includes("?page="))
    return false;

  if (url.includes("/2026/")) return true;

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

// ── Boilerplate detection (Phase 2 trigger) ──────────────────────────────────

const POLICY_KEYWORDS = [
  "housing",
  "healthcare",
  "tax",
  "education",
  "environment",
  "transport",
  "immigration",
  "economy",
  "policy",
  "policies",
  "manifesto",
  "pledge",
  "promise",
  "i will",
  "i aim",
  "i would",
  "wage",
  "cost of living",
  "vision",
  "i believe",
  "i am committed",
  "my vision",
  "my aim",
  "my goal",
];

const FLOW_BOILERPLATE_PATTERNS = [
  /has\s+participated\s+in\s+\d+\s+elections?\s+since/i,
  /has\s+declared\s+(?:his|her|their)\s+intention\s+to\s+stand/i,
  /^election\s+history$/im,
];

/**
 * Returns true if `manifestoRaw` is empty OR appears to be flow.je
 * boilerplate (election history listing, no real policy content).
 */
function isManifestoBoilerplate(manifestoRaw: string | null): boolean {
  if (!manifestoRaw) return true;
  const text = manifestoRaw.trim();
  if (text.length < 200) return true;

  const lower = text.toLowerCase();
  const policyHits = POLICY_KEYWORDS.filter((k) => lower.includes(k)).length;

  const looksLikeBoilerplate = FLOW_BOILERPLATE_PATTERNS.some((re) =>
    re.test(text),
  );

  // Long + no boilerplate markers + has policy language → real manifesto
  if (text.length >= 800 && policyHits >= 3 && !looksLikeBoilerplate) {
    return false;
  }

  // Flow.je boilerplate signature dominates → boilerplate
  if (looksLikeBoilerplate && policyHits < 4) return true;

  // Short and weak on policy language → boilerplate
  if (text.length < 800 && policyHits < 3) return true;

  return false;
}

/**
 * True if the manifesto already contains substantive 2026 content.
 * Used as a final safety net so we never overwrite a real 2026 manifesto.
 */
function alreadyHas2026Content(manifestoRaw: string | null): boolean {
  if (!manifestoRaw) return false;
  if (manifestoRaw.length < 800) return false;
  if (!/2026/.test(manifestoRaw)) return false;
  const lower = manifestoRaw.toLowerCase();
  const policyHits = POLICY_KEYWORDS.filter((k) => lower.includes(k)).length;
  return policyHits >= 4;
}

// ── Vote.je URL discovery from flow.je markdown ──────────────────────────────

const VOTE_JE_CANDIDATE_RE =
  /https?:\/\/(?:www\.)?vote\.je\/candidates\/(\d{4})\/[a-z0-9-]+\/?/gi;

/**
 * Extract historical vote.je candidate URLs from a flow.je markdown body.
 * Returns sorted (most recent year first) and deduplicated.
 */
function extractVoteJeArchiveUrls(
  markdown: string,
): Array<{ url: string; year: number }> {
  const found = new Map<string, number>();
  for (const match of markdown.matchAll(VOTE_JE_CANDIDATE_RE)) {
    const url = match[0].replace(/\\/g, "");
    const year = Number(match[1]);
    if (!Number.isFinite(year)) continue;
    if (!found.has(url)) found.set(url, year);
  }
  return [...found.entries()]
    .map(([url, year]) => ({ url, year }))
    .sort((a, b) => b.year - a.year);
}

// ── Phase 1: 2026 mapping ────────────────────────────────────────────────────

type Stats = {
  scraped: number;
  matched: number;
  updated: number;
  noMatch: number;
  failed: number;
};

type CandidateRow = typeof candidates.$inferSelect;

async function runPhase1(allCandidates: CandidateRow[]): Promise<Stats> {
  const stats: Stats = {
    scraped: 0,
    matched: 0,
    updated: 0,
    noMatch: 0,
    failed: 0,
  };

  console.log("[manifestos] Phase 1 — mapping vote.je for 2026 manifesto pages…");
  let allUrls: string[];
  try {
    allUrls = await mapSite(BASE_URL);
  } catch (err) {
    console.warn(
      `[manifestos] Phase 1 map failed: ${err instanceof Error ? err.message : err}`,
    );
    console.log("[manifestos] Skipping Phase 1 (vote.je may not be reachable).\n");
    return stats;
  }

  const manifestoUrls = [...new Set(allUrls.filter(is2026ManifestoUrl))];
  console.log(
    `[manifestos] Phase 1 — found ${manifestoUrls.length} potential 2026 manifesto pages`,
  );

  if (manifestoUrls.length === 0) {
    console.log(
      "[manifestos] Phase 1 — no 2026 manifesto pages found yet. Continuing to Phase 2.\n",
    );
    return stats;
  }

  for (const url of manifestoUrls) {
    console.log(`[manifestos] Scraping: ${url}`);

    let page;
    try {
      page = await scrapeUrl(url, { formats: ["markdown"] });
    } catch (err) {
      console.warn(
        `  ✗ Scrape failed: ${err instanceof Error ? err.message : err}`,
      );
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

      const mergedSourceUrls = [
        ...new Set([...(existing.sourceUrls ?? []), url]),
      ];

      await db
        .update(candidates)
        .set({
          manifestoRaw: page.markdown,
          manifestoUrl: url,
          sourceUrls: mergedSourceUrls,
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

  return stats;
}

// ── Phase 2: historical fallback ─────────────────────────────────────────────

type HistoricalStats = {
  considered: number;
  scrapedFlow: number;
  archiveFound: number;
  archiveScraped: number;
  updated: number;
  skippedHas2026: number;
  noArchiveLink: number;
  failed: number;
};

const HISTORICAL_NOTE_PREFIX = "[Historical manifesto from vote.je —";

async function runPhase2(allCandidates: CandidateRow[]): Promise<HistoricalStats> {
  const stats: HistoricalStats = {
    considered: 0,
    scrapedFlow: 0,
    archiveFound: 0,
    archiveScraped: 0,
    updated: 0,
    skippedHas2026: 0,
    noArchiveLink: 0,
    failed: 0,
  };

  console.log("[manifestos] Phase 2 — historical vote.je archive fallback…\n");

  const candidatesPool = SLUG_FILTER
    ? allCandidates.filter((c) => c.slug === SLUG_FILTER)
    : allCandidates;

  const targets = candidatesPool.filter((c) => {
    if (alreadyHas2026Content(c.manifestoRaw)) {
      stats.skippedHas2026++;
      return false;
    }
    return isManifestoBoilerplate(c.manifestoRaw);
  });

  stats.considered = targets.length;
  console.log(
    `[manifestos] Phase 2 — ${targets.length} candidates with empty/boilerplate manifestos`,
  );
  console.log(
    `[manifestos] Phase 2 — ${stats.skippedHas2026} skipped (already have 2026 content)\n`,
  );

  for (const candidate of targets) {
    console.log(`[manifestos] → ${candidate.name} (${candidate.slug})`);

    // Pull any vote.je URL the DB already has (none today, but future-proof).
    const existingArchiveFromSources = (candidate.sourceUrls ?? []).filter(
      (u) => /vote\.je\/candidates\/\d{4}\//i.test(u),
    );

    let archiveCandidates: Array<{ url: string; year: number }> =
      existingArchiveFromSources.map((url) => {
        const yMatch = url.match(/\/candidates\/(\d{4})\//);
        return { url, year: yMatch ? Number(yMatch[1]) : 0 };
      });

    // If we don't have an archive URL stored, fish it out of flow.je.
    if (archiveCandidates.length === 0 && candidate.manifestoUrl) {
      try {
        const flowPage = await scrapeUrl(candidate.manifestoUrl, {
          formats: ["markdown"],
        });
        stats.scrapedFlow++;
        archiveCandidates = extractVoteJeArchiveUrls(flowPage.markdown ?? "");
        await sleep(RATE_LIMIT_MS);
      } catch (err) {
        console.warn(
          `  ✗ Could not re-scrape flow.je profile: ${err instanceof Error ? err.message : err}`,
        );
        stats.failed++;
        continue;
      }
    }

    if (archiveCandidates.length === 0) {
      console.log("  ⚠ No vote.je archive URL discoverable — skipping");
      stats.noArchiveLink++;
      continue;
    }

    stats.archiveFound++;
    archiveCandidates.sort((a, b) => b.year - a.year);
    const target = archiveCandidates[0]!;
    console.log(`  • Archive URL: ${target.url} (year ${target.year})`);

    let archivePage;
    try {
      archivePage = await scrapeUrl(target.url, { formats: ["markdown"] });
      stats.archiveScraped++;
    } catch (err) {
      console.warn(
        `  ✗ Archive scrape failed: ${err instanceof Error ? err.message : err}`,
      );
      stats.failed++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const body = (archivePage.markdown ?? "").trim();
    if (body.length < 400) {
      console.warn(`  ⚠ Archive content too short (${body.length} chars) — skipping`);
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const note = `${HISTORICAL_NOTE_PREFIX} ${target.year} election. No 2026 manifesto published yet.]\n\n`;
    const newManifesto = `${note}${body}`;

    // Final safety net: never overwrite a manifesto that's clearly 2026 content.
    if (alreadyHas2026Content(candidate.manifestoRaw)) {
      console.log("  = Skipping — manifesto already contains 2026 content");
      stats.skippedHas2026++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Skip if we'd be writing the same historical content back.
    const newHash = sha256(newManifesto);
    if (newHash === (candidate.dataHash ?? "") && (candidate.manifestoRaw ?? "").startsWith(HISTORICAL_NOTE_PREFIX)) {
      console.log("  = Already populated with this historical manifesto");
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    console.log(
      `  ✓ Updating: ${candidate.name} — ${body.length} chars from vote.je ${target.year}`,
    );

    if (!DRY_RUN) {
      await db.insert(snapshots).values({
        entityType: "candidate",
        entityId: candidate.id,
        data: {
          name: candidate.name,
          manifesto_raw: candidate.manifestoRaw,
          manifesto_url: candidate.manifestoUrl,
          source_urls: candidate.sourceUrls,
          data_hash: candidate.dataHash,
          source: "pre-historical-vote-je-fallback",
        },
      });

      const mergedSourceUrls = [
        ...new Set([...(candidate.sourceUrls ?? []), target.url]),
      ];

      await db
        .update(candidates)
        .set({
          manifestoRaw: newManifesto,
          // Keep manifestoUrl as flow.je if currently set; otherwise use the archive URL.
          manifestoUrl: candidate.manifestoUrl ?? target.url,
          sourceUrls: mergedSourceUrls,
          dataHash: newHash,
          aiSummary: null,
          aiIssues: null,
          lastEnrichedAt: null,
          lastScrapedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, candidate.id));

      stats.updated++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  return stats;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  const allCandidates = await db.select().from(candidates);
  console.log(`[manifestos] Loaded ${allCandidates.length} DB candidates\n`);

  const phase1 = SLUG_FILTER
    ? { scraped: 0, matched: 0, updated: 0, noMatch: 0, failed: 0 }
    : await runPhase1(allCandidates);

  // Reload candidates so Phase 2 sees Phase 1's writes.
  const refreshed = await db.select().from(candidates);
  const phase2 = await runPhase2(refreshed);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n[manifestos] ══════════════════════════════════════`);
  console.log(`[manifestos] Phase 1 (2026 mapping)`);
  console.log(`[manifestos]   Scraped  : ${phase1.scraped}`);
  console.log(`[manifestos]   Matched  : ${phase1.matched}`);
  console.log(`[manifestos]   Updated  : ${phase1.updated}`);
  console.log(`[manifestos]   No match : ${phase1.noMatch}`);
  console.log(`[manifestos]   Failed   : ${phase1.failed}`);
  console.log(`[manifestos] Phase 2 (historical fallback)`);
  console.log(`[manifestos]   Considered      : ${phase2.considered}`);
  console.log(`[manifestos]   Flow.je rescrap : ${phase2.scrapedFlow}`);
  console.log(`[manifestos]   Archive found   : ${phase2.archiveFound}`);
  console.log(`[manifestos]   Archive scraped : ${phase2.archiveScraped}`);
  console.log(`[manifestos]   Updated         : ${phase2.updated}`);
  console.log(`[manifestos]   No archive link : ${phase2.noArchiveLink}`);
  console.log(`[manifestos]   Skipped (2026)  : ${phase2.skippedHas2026}`);
  console.log(`[manifestos]   Failed          : ${phase2.failed}`);
  console.log(`[manifestos] Total: ${elapsed}s`);
  if (DRY_RUN) console.log("[manifestos] (DRY RUN — no DB writes)");
  if (phase1.updated + phase2.updated > 0) {
    console.log(
      "\n[manifestos] Run npm run extract:social and npm run enrich:batch next.",
    );
  }

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[manifestos] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
