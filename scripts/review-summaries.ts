/**
 * Kimi K2.6 supervision pass — reviews Grok-generated candidate summaries.
 *
 * Default mode picks up only summaries enriched since the last review (so the
 * daily cron only spends Kimi tokens on what changed). Flags can override:
 *
 *   npx tsx scripts/review-summaries.ts                   ← only changed
 *   npx tsx scripts/review-summaries.ts --all             ← every summary
 *   npx tsx scripts/review-summaries.ts --failed-only     ← retry fails
 *   npx tsx scripts/review-summaries.ts --slug=sam-mzec   ← single
 *   npx tsx scripts/review-summaries.ts --dry-run         ← no API calls
 */

import "./bootstrap-env";
import { db } from "@/db";
import { candidates, type ReviewStatus } from "@/db/schema";
import { eq, isNotNull, isNull, and, or, sql } from "drizzle-orm";
import { reviewCandidateSummary } from "@/lib/supervisor";

const args = process.argv.slice(2);
const SLUG = args.find((a) => a.startsWith("--slug="))?.split("=")[1];
const ALL = args.includes("--all");
const FAILED = args.includes("--failed-only");
const DRY_RUN = args.includes("--dry-run");

// 4s between calls — Kimi K2.6 typically takes 2-4s, plus a small buffer to
// stay under OpenRouter's per-key rate limits.
const DELAY_MS = 4000;

const SELECT = {
  id: candidates.id,
  name: candidates.name,
  slug: candidates.slug,
  district: candidates.district,
  party: candidates.party,
  role: candidates.role,
  aiSummary: candidates.aiSummary,
  aiIssues: candidates.aiIssues,
  manifestoRaw: candidates.manifestoRaw,
  lastEnrichedAt: candidates.lastEnrichedAt,
  lastReviewedAt: candidates.lastReviewedAt,
  reviewStatus: candidates.reviewStatus,
};

type CandidateRow = {
  id: string;
  name: string;
  slug: string;
  district: string;
  party: string | null;
  role: string | null;
  aiSummary: string | null;
  aiIssues: unknown;
  manifestoRaw: string | null;
  lastEnrichedAt: Date | null;
  lastReviewedAt: Date | null;
  reviewStatus: unknown;
};

async function loadRows(): Promise<CandidateRow[]> {
  if (SLUG) {
    return db.select(SELECT).from(candidates).where(eq(candidates.slug, SLUG));
  }
  if (ALL) {
    return db
      .select(SELECT)
      .from(candidates)
      .where(isNotNull(candidates.aiSummary));
  }
  if (FAILED) {
    return db
      .select(SELECT)
      .from(candidates)
      .where(
        and(
          isNotNull(candidates.aiSummary),
          sql`(${candidates.reviewStatus}->>'passed')::boolean = false`,
        ),
      );
  }
  // Default: never reviewed, OR re-enriched since last review.
  return db
    .select(SELECT)
    .from(candidates)
    .where(
      and(
        isNotNull(candidates.aiSummary),
        or(
          isNull(candidates.lastReviewedAt),
          sql`${candidates.lastEnrichedAt} > ${candidates.lastReviewedAt}`,
        ),
      ),
    );
}

async function main() {
  console.log("\n=== VotePulse — Kimi K2.6 Supervisor ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log("Model: moonshotai/kimi-k2.6 via OpenRouter\n");

  if (!DRY_RUN && !process.env.OPENROUTER_API_KEY?.trim()) {
    console.error("ERROR: OPENROUTER_API_KEY not set in environment");
    console.error("       Add it to .env.local (https://openrouter.ai/settings/keys)");
    process.exit(1);
  }

  const rows = await loadRows();
  console.log(`Candidates queued: ${rows.length}\n`);

  let passed = 0;
  let failed = 0;
  let errors = 0;
  let skipped = 0;
  let autoCorrected = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const prefix = `[${i + 1}/${rows.length}] ${row.name}`;

    if (!row.aiSummary || !row.manifestoRaw) {
      console.log(`${prefix} — SKIP (missing summary or manifesto)`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`${prefix} — [DRY RUN] would review`);
      continue;
    }

    console.log(`${prefix}`);

    try {
      const aiIssues = Array.isArray(row.aiIssues)
        ? (
            row.aiIssues as Array<{
              issue: string;
              position: string;
              source_quote?: string;
              sourceQuote?: string;
              confidence: number;
            }>
          ).map((i) => ({
            issue: i.issue,
            position: i.position,
            sourceQuote: i.sourceQuote ?? i.source_quote ?? "",
            confidence: i.confidence,
          }))
        : [];

      const result = await reviewCandidateSummary({
        candidateName: row.name,
        district: row.district,
        party: row.party,
        role: row.role,
        manifestoRaw: row.manifestoRaw,
        aiSummary: row.aiSummary,
        aiIssues,
      });

      const reviewStatus: ReviewStatus = {
        reviewedAt: result.reviewedAt,
        model: result.model,
        score: result.score,
        passed: result.passed,
        flags: result.flags,
        correctedSummary: result.correctedSummary,
        reasoning: result.reasoning,
      };

      const updates: Record<string, unknown> = {
        reviewStatus,
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
      };

      // Auto-correct: only when Grok's summary is genuinely bad (score ≤ 5)
      // AND Kimi has supplied a replacement. 6-7 still passes review for human
      // inspection without overwriting.
      if (!result.passed && result.correctedSummary && result.score <= 5) {
        updates.aiSummary = result.correctedSummary;
        autoCorrected++;
        console.log(
          `  ⚠ SCORE ${result.score}/10 — Grok summary replaced with Kimi correction`,
        );
      }

      await db
        .update(candidates)
        .set(updates)
        .where(eq(candidates.id, row.id));

      if (result.passed) {
        console.log(`  ✓ PASS (${result.score}/10) — ${result.reasoning}`);
        for (const f of result.flags) {
          console.log(
            `    note: [${f.severity}] ${f.type}: ${f.description}`,
          );
        }
        passed++;
      } else {
        console.log(`  ✗ FAIL (${result.score}/10) — ${result.reasoning}`);
        for (const f of result.flags) {
          console.log(
            `    flag: [${f.severity}] ${f.type}: ${f.description}`,
          );
        }
        failed++;
      }
    } catch (err) {
      console.error(
        `  ERROR: ${err instanceof Error ? err.message : String(err)}`,
      );
      errors++;
    }

    if (i < rows.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log("\n=== RESULTS ===");
  console.log(`  Passed:         ${passed}`);
  console.log(
    `  Failed:         ${failed}${failed > 0 ? "  ← run --failed-only to re-review" : ""}`,
  );
  console.log(`  Auto-corrected: ${autoCorrected}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Skipped:        ${skipped}`);
  console.log(`  Total:          ${rows.length}`);
  console.log("===============\n");

  if (failed > 0) {
    console.log(
      `⚠ ${failed} summaries failed. Check /admin/candidates for details.`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[supervisor] Fatal:", err);
    process.exit(1);
  });
