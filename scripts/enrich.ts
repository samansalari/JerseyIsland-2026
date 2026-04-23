import "./bootstrap-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNull, or, lt, and, isNotNull, sql as sqlTag } from "drizzle-orm";
import {
  candidates,
  candidateIssues,
  issues,
  snapshots,
} from "../src/db/schema";
import { grokChatCompletionJson } from "../src/lib/grok";

/**
 * VotePulse — Candidate Enrichment Pipeline
 *
 * Reads manifestos → calls xAI Grok → writes AI summaries, issue positions,
 * and snapshots to Postgres. Idempotent: re-running refreshes stale data
 * without duplicating.
 *
 * Usage:
 *   npx tsx scripts/enrich.ts
 *   npx tsx scripts/enrich.ts --candidate-slug=marie-le-breton
 *
 * Requires:
 *   GROK_API_KEY (or XAI_API_KEY) in env (or .env.local)
 *   DATABASE_URL in env (or .env.local)
 */

// ── Config ──────────────────────────────────────────────────────────────────

const MODEL = process.env.GROK_MODEL?.trim() || "grok-2-latest";
const DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;
const STALE_DAYS = 7;

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

// ── Bootstrap ───────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const GROK_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY;

if (!DATABASE_URL) {
  console.error("[enrich] ✗ DATABASE_URL not set");
  process.exit(1);
}
if (!GROK_KEY?.trim()) {
  console.error(
    "[enrich] ✗ GROK_API_KEY (or XAI_API_KEY) not set — add to .env.local",
  );
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, {
  schema: { candidates, candidateIssues, issues, snapshots },
});

// ── Types ───────────────────────────────────────────────────────────────────

interface EnrichmentResult {
  summary: string;
  key_promises: string[];
  issues: Array<{
    issue: string;
    position: string;
    source_quote: string;
    confidence: number;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fuzzy substring match — returns similarity ratio 0–1. */
function fuzzyMatch(needle: string, haystack: string): number {
  const n = needle.toLowerCase().replace(/\s+/g, " ").trim();
  const h = haystack.toLowerCase().replace(/\s+/g, " ").trim();
  if (h.includes(n)) return 1.0;
  // Simple longest-common-subsequence ratio
  const lcs = lcsLength(n, h);
  return lcs / n.length;
}

function lcsLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return 0;
  // Space-optimised LCS (only need 2 rows)
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]! + 1;
      } else {
        curr[j] = Math.max(prev[j]!, curr[j - 1]!);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev.reduce((max, v) => Math.max(max, v), 0);
}

/** Call Grok with one retry on parse / transport failure. */
async function callGrokForManifesto(
  candidateName: string,
  district: string,
  manifestoRaw: string,
): Promise<EnrichmentResult> {
  const systemPrompt = `You are a neutral political analyst summarising election manifestos for Jersey's 2026 general election. You must be balanced, factual, and never editorialize. Every claim must be directly supported by the manifesto text. If the text is ambiguous on an issue, say so rather than guessing.`;

  const userPrompt = `Analyse the following manifesto for ${candidateName}, running in ${district}.

Return ONLY a JSON object with this exact structure, no markdown, no preamble:
{
  "summary": "A 2-3 paragraph neutral summary of their key positions and priorities",
  "key_promises": ["specific promise 1", "specific promise 2", ...],
  "issues": [
    {
      "issue": "one of: housing, healthcare, tax, education, environment, transport, cost_of_living, immigration, economy, public_services",
      "position": "Their stance in 1-2 sentences",
      "source_quote": "Exact quote from the manifesto text supporting this position",
      "confidence": 0.0 to 1.0
    }
  ]
}

Rules:
- Only include issues the manifesto explicitly addresses
- source_quote MUST be a verbatim quote from the manifesto text below
- If the manifesto is vague on an issue, set confidence below 0.5
- Do NOT infer positions that aren't stated
- key_promises should be specific and verifiable, not vague

Manifesto text:
---
${manifestoRaw}
---`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await grokChatCompletionJson<EnrichmentResult>({
        systemPrompt,
        userPrompt,
        temperature: 0,
        maxTokens: 4096,
        model: MODEL,
      });
    } catch (err) {
      if (attempt === 0) {
        console.warn(
          `  ⚠ Attempt 1 failed for ${candidateName}: ${err instanceof Error ? err.message : err}`,
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
  const args = process.argv.slice(2);
  const slugFlag = args
    .find((a) => a.startsWith("--candidate-slug="))
    ?.split("=")[1];

  // Fetch issue name→id map
  const issueRows = await db.select().from(issues);
  const issueMap = new Map(issueRows.map((i) => [i.name, i.id]));

  // Build query
  const staleDate = new Date(Date.now() - STALE_DAYS * 86400_000);

  let query = db.select().from(candidates);
  let rows;

  if (slugFlag) {
    rows = await query.where(eq(candidates.slug, slugFlag));
    if (rows.length === 0) {
      console.error(`[enrich] ✗ No candidate found with slug "${slugFlag}"`);
      process.exit(1);
    }
    if (!rows[0]!.manifestoRaw) {
      console.error(
        `[enrich] ✗ Candidate "${slugFlag}" has no manifesto_raw. Seed it first.`,
      );
      process.exit(1);
    }
  } else {
    rows = await query.where(
      and(
        isNotNull(candidates.manifestoRaw),
        or(
          isNull(candidates.aiSummary),
          lt(candidates.lastEnrichedAt, staleDate),
        ),
      ),
    );
  }

  console.log(`[enrich] Found ${rows.length} candidate(s) to process\n`);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of rows) {
    const t0 = Date.now();
    console.log(
      `[enrich] Processing: ${candidate.name} (${candidate.district})`,
    );

    if (!candidate.manifestoRaw) {
      console.log(`  ⏭ Skipped — no manifesto_raw`);
      skipped++;
      continue;
    }

    try {
      // 1. Call Grok
      const result = await callGrokForManifesto(
        candidate.name,
        candidate.district,
        candidate.manifestoRaw,
      );

      // 2. Validate
      const validIssues: typeof result.issues = [];
      for (const entry of result.issues) {
        // Validate issue name
        if (!VALID_ISSUES.has(entry.issue)) {
          console.warn(`  ⚠ Unknown issue "${entry.issue}" — skipping`);
          continue;
        }

        // Validate confidence
        if (
          typeof entry.confidence !== "number" ||
          entry.confidence < 0 ||
          entry.confidence > 1
        ) {
          console.warn(
            `  ⚠ Invalid confidence ${entry.confidence} for "${entry.issue}" — clamping`,
          );
          entry.confidence = Math.max(0, Math.min(1, Number(entry.confidence) || 0.5));
        }

        // Validate source_quote
        const matchScore = fuzzyMatch(
          entry.source_quote,
          candidate.manifestoRaw,
        );
        if (matchScore < 0.7) {
          console.warn(
            `  ⚠ Source quote for "${entry.issue}" has low match (${(matchScore * 100).toFixed(0)}%) — flagging`,
          );
        }

        validIssues.push(entry);
      }

      // 3. Snapshot previous state
      await db.insert(snapshots).values({
        entityType: "candidate",
        entityId: candidate.id,
        data: {
          ai_summary: candidate.aiSummary,
          ai_issues: candidate.aiIssues,
          last_enriched_at: candidate.lastEnrichedAt,
        },
      });

      // 4. Update candidate
      const now = new Date();
      await db
        .update(candidates)
        .set({
          aiSummary: result.summary,
          aiIssues: validIssues.map((i) => ({
            issue: i.issue,
            position: i.position,
            confidence: i.confidence,
            source_quote: i.source_quote,
          })),
          lastEnrichedAt: now,
          updatedAt: now,
        })
        .where(eq(candidates.id, candidate.id));

      // 5. Upsert candidate_issues
      for (const entry of validIssues) {
        const issueId = issueMap.get(entry.issue);
        if (!issueId) {
          console.warn(
            `  ⚠ Issue "${entry.issue}" not in issues table — skipping junction row`,
          );
          continue;
        }

        await db
          .insert(candidateIssues)
          .values({
            candidateId: candidate.id,
            issueId,
            position: entry.position,
            sourceQuote: entry.source_quote,
            confidence: entry.confidence,
          })
          .onConflictDoUpdate({
            target: [candidateIssues.candidateId, candidateIssues.issueId],
            set: {
              position: sqlTag`excluded.position`,
              sourceQuote: sqlTag`excluded.source_quote`,
              confidence: sqlTag`excluded.confidence`,
            },
          });
      }

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `  ✓ Done — ${validIssues.length} issues extracted (${elapsed}s)`,
      );
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed: ${msg}`);
      failed++;
    }

    // Rate limit
    if (rows.indexOf(candidate) < rows.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[enrich] ══════════════════════════════════════`);
  console.log(`[enrich] Processed: ${processed}`);
  console.log(`[enrich] Failed:    ${failed}`);
  console.log(`[enrich] Skipped:   ${skipped}`);
  console.log(`[enrich] Total:     ${totalElapsed}s`);

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[enrich] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
