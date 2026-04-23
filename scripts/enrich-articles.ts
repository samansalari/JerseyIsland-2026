import "./bootstrap-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNull } from "drizzle-orm";
import { articles, candidates } from "../src/db/schema";
import { grokChatCompletionJson } from "../src/lib/grok";

/**
 * VotePulse — Article Enrichment Pipeline
 *
 * Reads articles without AI summaries → calls xAI Grok → writes
 * summary, sentiment, and candidate_mentions back to Postgres.
 *
 * Usage:
 *   npx tsx scripts/enrich-articles.ts
 *
 * Requires:
 *   GROK_API_KEY (or XAI_API_KEY) in env (or .env.local)
 *   DATABASE_URL in env (or .env.local)
 */

// ── Config ──────────────────────────────────────────────────────────────────

const MODEL = process.env.GROK_MODEL?.trim() || "grok-2-latest";
const DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;

// ── Bootstrap ───────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const GROK_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY;

if (!DATABASE_URL) {
  console.error("[enrich-articles] ✗ DATABASE_URL not set");
  process.exit(1);
}
if (!GROK_KEY?.trim()) {
  console.error(
    "[enrich-articles] ✗ GROK_API_KEY (or XAI_API_KEY) not set — add to .env.local",
  );
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { articles, candidates } });

// ── Types ───────────────────────────────────────────────────────────────────

interface ArticleResult {
  summary: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  candidate_names_mentioned: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Case-insensitive fuzzy name match. */
function matchCandidateName(
  mentioned: string,
  knownCandidates: { id: string; name: string }[],
): string | null {
  const lower = mentioned.toLowerCase().trim();

  // Exact match
  const exact = knownCandidates.find(
    (c) => c.name.toLowerCase() === lower,
  );
  if (exact) return exact.id;

  // Substring match (AI might return "Le Breton" instead of "Marie Le Breton")
  const partial = knownCandidates.find(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      lower.includes(c.name.toLowerCase()),
  );
  if (partial) return partial.id;

  // Split-token match: all tokens of the mentioned name appear in candidate name
  const tokens = lower.split(/\s+/);
  const tokenMatch = knownCandidates.find((c) => {
    const cLower = c.name.toLowerCase();
    return tokens.every((t) => cLower.includes(t));
  });
  if (tokenMatch) return tokenMatch.id;

  return null;
}

/** Call Grok with one retry. */
async function callGrokForArticle(
  title: string,
  source: string,
  contentRaw: string,
): Promise<ArticleResult> {
  const systemPrompt = `You are summarising news about Jersey's 2026 general election. Be neutral and factual. Output only valid JSON as instructed in the user message — no markdown fences.`;

  const userPrompt = `Summarise and analyse the following article.

Return ONLY a JSON object:
{
  "summary": "2 sentence neutral summary",
  "sentiment": "positive | negative | neutral | mixed",
  "candidate_names_mentioned": ["Name 1", "Name 2"]
}

Article title: ${title}
Source: ${source}
Article text:
---
${contentRaw}
---`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = await grokChatCompletionJson<ArticleResult>({
        systemPrompt,
        userPrompt,
        temperature: 0,
        maxTokens: 1024,
        model: MODEL,
      });

      // Normalise sentiment
      const validSentiments = new Set([
        "positive",
        "negative",
        "neutral",
        "mixed",
      ]);
      if (!validSentiments.has(parsed.sentiment)) {
        parsed.sentiment = "neutral";
      }

      return parsed;
    } catch (err) {
      if (attempt === 0) {
        console.warn(
          `  ⚠ Attempt 1 failed: ${err instanceof Error ? err.message : err}`,
        );
        console.warn(`  ⚠ Retrying in ${RETRY_DELAY_MS / 1000}s…`);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw err;
      }
    }
  }

  throw new Error("Unreachable");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  // Fetch all known candidates for name matching
  const allCandidates = await db
    .select({ id: candidates.id, name: candidates.name })
    .from(candidates);

  console.log(
    `[enrich-articles] ${allCandidates.length} known candidates for name matching`,
  );

  // Fetch articles needing enrichment
  const rows = await db
    .select()
    .from(articles)
    .where(isNull(articles.aiSummary));

  console.log(
    `[enrich-articles] Found ${rows.length} article(s) to process\n`,
  );

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const article of rows) {
    const t0 = Date.now();
    console.log(`[enrich-articles] Processing: "${article.title}"`);

    if (!article.contentRaw) {
      console.log(`  ⏭ Skipped — no content_raw`);
      skipped++;
      continue;
    }

    try {
      const result = await callGrokForArticle(
        article.title,
        article.source,
        article.contentRaw,
      );

      // Match candidate names to IDs
      const mentionedIds: string[] = [];
      for (const name of result.candidate_names_mentioned) {
        const id = matchCandidateName(name, allCandidates);
        if (id) {
          mentionedIds.push(id);
        } else {
          console.warn(`  ⚠ Could not match candidate name "${name}"`);
        }
      }

      // Deduplicate
      const uniqueIds = [...new Set(mentionedIds)];

      // Update article
      await db
        .update(articles)
        .set({
          aiSummary: result.summary,
          aiSentiment: result.sentiment === "mixed" ? "neutral" : result.sentiment,
          candidateMentions: uniqueIds,
        })
        .where(eq(articles.id, article.id));

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `  ✓ Done — sentiment: ${result.sentiment}, mentions: ${uniqueIds.length} (${elapsed}s)`,
      );
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed: ${msg}`);
      failed++;
    }

    // Rate limit
    if (rows.indexOf(article) < rows.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[enrich-articles] ══════════════════════════════════════`);
  console.log(`[enrich-articles] Processed: ${processed}`);
  console.log(`[enrich-articles] Failed:    ${failed}`);
  console.log(`[enrich-articles] Skipped:   ${skipped}`);
  console.log(`[enrich-articles] Total:     ${totalElapsed}s`);

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[enrich-articles] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
