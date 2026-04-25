/**
 * VotePulse — Social Media Scraper
 *
 * Scrapes candidate Facebook pages and personal websites via Firecrawl,
 * then uses Grok to extract policy-relevant statements and merges them
 * into the existing ai_summary / ai_issues columns.
 *
 * Skips Twitter/X and Instagram (auth walls).
 *
 * Usage:
 *   npx tsx scripts/scrape-social.ts
 *   npx tsx scripts/scrape-social.ts --dry-run
 *   npx tsx scripts/scrape-social.ts --slug=john-smith
 *   npx tsx scripts/scrape-social.ts --force   (re-scrape even if recent)
 */

import "./bootstrap-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNotNull } from "drizzle-orm";
import { candidates } from "../src/db/schema";
import { scrapeUrl, FirecrawlError } from "../src/lib/firecrawl";
import { grokChatCompletionJson } from "../src/lib/grok";

// ── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const SINGLE_SLUG = args.find((a) => a.startsWith("--slug="))?.split("=")[1];

// Platforms worth scraping (skip twitter/x/instagram — auth walls)
const SCRAPEABLE_PLATFORMS = ["facebook", "website", "linkedin"] as const;

// Don't re-scrape if scraped within this many hours
const RESCRAPE_THRESHOLD_HOURS = 20;

// Valid Jersey policy issue slugs
const VALID_ISSUES = new Set([
  "housing",
  "healthcare",
  "tax",
  "education",
  "environment",
  "transport",
  "cost_of_living",
  "immigration",
  "economy",
  "public_services",
]);

// ── DB setup ─────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[scrape-social] ✗ DATABASE_URL not set (.env.local)");
  process.exit(1);
}
if (!process.env.FIRECRAWL_API_KEY) {
  console.error("[scrape-social] ✗ FIRECRAWL_API_KEY not set (.env.local)");
  process.exit(1);
}
if (!process.env.GROK_API_KEY && !process.env.XAI_API_KEY) {
  console.error(
    "[scrape-social] ✗ GROK_API_KEY (or XAI_API_KEY) not set (.env.local)",
  );
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 2,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { candidates } });

// ── Types ─────────────────────────────────────────────────────────────────────

interface PolicyStatement {
  topic: string;
  statement: string;
  sourceText: string;
  date: string | null;
  sourceUrl: string;
}

interface PolicyContent {
  hasNewContent: boolean;
  policyStatements: PolicyStatement[];
  updatedSummaryAddition: string | null;
}

interface ExistingIssue {
  issue: string;
  position: string;
  source_quote: string;
  confidence: number;
}

// ── Scrape + extract ──────────────────────────────────────────────────────────

async function scrapeCandidateSocial(
  candidateName: string,
  socialLinks: Record<string, string>,
  existingSummary: string | null,
): Promise<PolicyContent> {
  const scrapedContent: Array<{ url: string; text: string }> = [];

  for (const platform of SCRAPEABLE_PLATFORMS) {
    const url = socialLinks[platform];
    if (!url) continue;

    console.log(`    Scraping ${platform}: ${url}`);

    try {
      const page = await scrapeUrl(url, { formats: ["markdown"] });

      if (page.markdown && page.markdown.length > 100) {
        scrapedContent.push({
          url,
          text: page.markdown.slice(0, 3000),
        });
        console.log(`      ✓ Got ${page.markdown.length} chars`);
      } else {
        console.log(`      ✗ Empty response`);
      }
    } catch (err) {
      const msg = err instanceof FirecrawlError ? err.message : String(err);
      console.log(`      ✗ Error: ${msg.slice(0, 80)}`);
    }

    // Rate limit between Firecrawl calls
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (scrapedContent.length === 0) {
    return {
      hasNewContent: false,
      policyStatements: [],
      updatedSummaryAddition: null,
    };
  }

  const combinedText = scrapedContent
    .map((s) => `=== FROM: ${s.url} ===\n${s.text}`)
    .join("\n\n");

  const systemPrompt = `You are a political analyst reviewing a Jersey election candidate's
social media and website content. Extract ONLY policy-relevant statements.

IGNORE completely:
- Personal photos, family updates, social events
- "Good morning Jersey" type posts
- Thanking people, generic engagement posts
- Shared articles without the candidate's own commentary
- Campaign announcements not containing policy positions

EXTRACT only:
- Explicit policy positions ("I will..." "We must..." "My plan is...")
- Responses to specific local issues with a stated position
- Direct quotes about what they would do in office

Jersey policy issues to classify against:
housing, healthcare, tax, education, environment, transport,
cost_of_living, immigration, economy, public_services

Return ONLY valid JSON, no markdown.`;

  const userPrompt = `Extract policy statements from ${candidateName}'s social media content.

EXISTING SUMMARY (for context, do not repeat):
${existingSummary ? existingSummary.slice(0, 500) : "(none yet)"}

SCRAPED CONTENT:
${combinedText}

Return JSON:
{
  "hasNewContent": true,
  "policyStatements": [
    {
      "topic": "one of the 10 valid issue slugs",
      "statement": "candidate's policy position in 1-2 sentences",
      "sourceText": "verbatim quote from the scraped content",
      "date": "YYYY-MM-DD or null",
      "sourceUrl": "which URL this came from"
    }
  ],
  "updatedSummaryAddition": "1-2 sentence addition to ai_summary, or null if nothing new"
}`;

  try {
    const { data } = await grokChatCompletionJson<PolicyContent>({
      systemPrompt,
      userPrompt,
      temperature: 0,
      maxTokens: 1024,
    });

    // Validate and filter to known issue slugs
    data.policyStatements = (data.policyStatements ?? []).filter(
      (s) => VALID_ISSUES.has(s.topic) && s.statement?.length > 10,
    );

    return data;
  } catch (err) {
    console.log(
      `      ✗ Grok error: ${err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80)}`,
    );
    return {
      hasNewContent: false,
      policyStatements: [],
      updatedSummaryAddition: null,
    };
  }
}

// ── Merge into DB ─────────────────────────────────────────────────────────────

async function mergePolicyIntoCandidate(
  candidateId: string,
  existing: { aiSummary: string | null; aiIssues: unknown },
  newContent: PolicyContent,
) {
  if (!newContent.hasNewContent || newContent.policyStatements.length === 0) {
    return;
  }

  const existingIssues: ExistingIssue[] = Array.isArray(existing.aiIssues)
    ? (existing.aiIssues as ExistingIssue[])
    : [];

  const issueMap = new Map<string, ExistingIssue>(
    existingIssues.map((i) => [i.issue, i]),
  );

  for (const stmt of newContent.policyStatements) {
    const current = issueMap.get(stmt.topic);
    // Social posts = 0.85 confidence (explicitly stated by the candidate).
    // Only replace if we don't already have a higher-confidence entry.
    if (!current || current.confidence < 0.85) {
      issueMap.set(stmt.topic, {
        issue: stmt.topic,
        position: stmt.statement,
        source_quote: stmt.sourceText,
        confidence: 0.85,
      });
    }
  }

  const mergedIssues = Array.from(issueMap.values());

  const updatedSummary = newContent.updatedSummaryAddition
    ? `${existing.aiSummary ?? ""}\n\n[Social media update] ${newContent.updatedSummaryAddition}`.trim()
    : existing.aiSummary;

  await db
    .update(candidates)
    .set({
      aiIssues: mergedIssues,
      aiSummary: updatedSummary,
      lastEnrichedAt: new Date(),
      lastScrapedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(candidates.id, candidateId));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== Social Media Scraper ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}${FORCE ? " + FORCE" : ""}`);

  const allRows = SINGLE_SLUG
    ? await db
        .select({
          id: candidates.id,
          name: candidates.name,
          slug: candidates.slug,
          socialLinks: candidates.socialLinks,
          aiSummary: candidates.aiSummary,
          aiIssues: candidates.aiIssues,
          lastScrapedAt: candidates.lastScrapedAt,
        })
        .from(candidates)
        .where(eq(candidates.slug, SINGLE_SLUG))
    : await db
        .select({
          id: candidates.id,
          name: candidates.name,
          slug: candidates.slug,
          socialLinks: candidates.socialLinks,
          aiSummary: candidates.aiSummary,
          aiIssues: candidates.aiIssues,
          lastScrapedAt: candidates.lastScrapedAt,
        })
        .from(candidates)
        .where(isNotNull(candidates.socialLinks));

  // Keep only candidates with at least one scrapeable platform URL
  const withScrapeable = allRows.filter((r) => {
    const links = r.socialLinks as Record<string, string> | null;
    if (!links) return false;
    return SCRAPEABLE_PLATFORMS.some((p) => links[p]);
  });

  // Unless --force, skip candidates scraped recently
  const needsScrape = FORCE
    ? withScrapeable
    : withScrapeable.filter((r) => {
        if (!r.lastScrapedAt) return true;
        const hoursSince =
          (Date.now() - new Date(r.lastScrapedAt).getTime()) / 3_600_000;
        return hoursSince > RESCRAPE_THRESHOLD_HOURS;
      });

  console.log(`Candidates with social links:  ${withScrapeable.length}`);
  console.log(`Due for scraping:              ${needsScrape.length}\n`);

  let processed = 0;
  let updated = 0;
  let noContent = 0;
  let failed = 0;

  for (const row of needsScrape) {
    processed++;
    const prefix = `[${processed}/${needsScrape.length}] ${row.name}`;
    console.log(prefix);

    const links = row.socialLinks as Record<string, string>;

    if (DRY_RUN) {
      const scrapeable = SCRAPEABLE_PLATFORMS.filter((p) => links[p]);
      console.log(`  [DRY RUN] Would scrape: ${scrapeable.join(", ")}`);
      continue;
    }

    try {
      const newContent = await scrapeCandidateSocial(
        row.name,
        links,
        row.aiSummary,
      );

      if (newContent.hasNewContent && newContent.policyStatements.length > 0) {
        await mergePolicyIntoCandidate(
          row.id,
          { aiSummary: row.aiSummary, aiIssues: row.aiIssues },
          newContent,
        );
        console.log(
          `  ✓ ${newContent.policyStatements.length} policy statement(s) merged`,
        );
        updated++;
      } else {
        console.log(`  — No new policy content found`);
        noContent++;

        // Still bump lastScrapedAt to avoid re-scraping on next run
        await db
          .update(candidates)
          .set({ lastScrapedAt: new Date() })
          .where(eq(candidates.id, row.id));
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${err}`);
      failed++;
    }

    // Rate limit between candidates
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("\n=== SUMMARY ===");
  console.log(`  Processed:  ${processed}`);
  console.log(`  Updated:    ${updated}`);
  console.log(`  No content: ${noContent}`);
  console.log(`  Failed:     ${failed}`);
  console.log("===============\n");

  await pgClient.end({ timeout: 5 });
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[scrape-social] Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
