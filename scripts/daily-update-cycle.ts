/**
 * VotePulse — Daily self-update pipeline orchestrator
 *
 * 1. Scrape vote.je for changed manifesto content
 * 2. Re-enrich candidates whose content changed (scrape newer than enrich)
 * 3. Kimi K2.6 supervises new summaries
 * 4. Regenerate topics if enough candidates changed
 * 5. Revalidate ISR cache
 *
 * Run: npx tsx scripts/daily-update-cycle.ts
 * Flags: --dry-run, --force (re-enrich all 2026 candidates with manifestos)
 */

import "./bootstrap-env";
import { db } from "../src/db";
import { candidates, cronLogs } from "../src/db/schema";
import { eq, and, isNotNull, isNull, sql } from "drizzle-orm";
import { execSync } from "node:child_process";
import type { ExecSyncException } from "node:child_process";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");

const TOPIC_REGEN_THRESHOLD = 3;

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://votepulse.je";

/**
 * Where POST /api/revalidate should be sent.
 * Local CLI runs often have NEXT_PUBLIC_SITE_URL=https://votepulse.je while
 * REVALIDATION_SECRET matches .env.local — calling prod returns 401. When
 * NODE_ENV is not production, target the local Next server instead.
 */
function resolveRevalidateOrigin(): string {
  const port = process.env.PORT ?? "3000";
  let base = SITE_URL.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }

  const hostIsLocal =
    base.includes("localhost") || base.includes("127.0.0.1");

  if (hostIsLocal) {
    return base;
  }

  if (process.env.NODE_ENV === "production") {
    return base;
  }

  return `http://127.0.0.1:${port}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/** Long-running AI/network batch jobs — Windows execSync defaults bit hard at 5 min. */
function execTimeoutMs(cmd: string): number {
  // Kimi over many candidates often exceeds 15m on Windows (`spawnSync` ETIMEDOUT).
  if (cmd.includes("review-summaries")) {
    return 1_800_000;
  }
  if (
    cmd.includes("scrape-vote-je-manifestos") ||
    cmd.includes("generate-topics")
  ) {
    return 900_000;
  }
  return 300_000;
}

async function run(
  cmd: string,
  label: string,
): Promise<{ ok: boolean; output: string; duration: number }> {
  const start = Date.now();
  console.log(`\n▶ ${label}`);
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would run: ${cmd}`);
    return { ok: true, output: "[dry run]", duration: 0 };
  }
  try {
    const output = execSync(cmd, {
      stdio: "pipe",
      timeout: execTimeoutMs(cmd),
      encoding: "utf8",
    });
    const duration = Date.now() - start;
    console.log(`  ✓ Done in ${(duration / 1000).toFixed(1)}s`);
    return { ok: true, output, duration };
  } catch (err: unknown) {
    const e = err as ExecSyncException;
    const duration = Date.now() - start;
    const msg =
      typeof e.stderr === "string"
        ? e.stderr
        : Buffer.isBuffer(e.stderr)
          ? e.stderr.toString("utf8")
          : "";
    const out =
      typeof e.stdout === "string"
        ? e.stdout
        : Buffer.isBuffer(e.stdout)
          ? e.stdout.toString("utf8")
          : "";
    console.error(
      `  ✗ Failed in ${(duration / 1000).toFixed(1)}s: ${(e.message ?? "").slice(0, 200)}`,
    );
    return {
      ok: false,
      output: (msg + out).slice(-500) || (e.message ?? ""),
      duration,
    };
  }
}

/**
 * Candidates needing Grok enrichment. `ai_summary` is cleared only when the
 * manifesto scraper detects new/changed policy text (hash mismatch); social or
 * flow scrapers bump `last_scraped_at` without clearing AI fields, so we must
 * NOT use last_scraped vs last_enriched alone.
 */
async function getCandidatesNeedingManifestoEnrichment(): Promise<string[]> {
  const rows = await db
    .select({ slug: candidates.slug })
    .from(candidates)
    .where(
      and(
        eq(candidates.is2026, true),
        isNotNull(candidates.manifestoRaw),
        isNull(candidates.aiSummary),
      ),
    )
    .orderBy(sql`${candidates.lastScrapedAt} DESC NULLS LAST`);
  return rows.map((r) => r.slug);
}

async function getCandidatesNeedingReview(): Promise<string[]> {
  const rows = await db
    .select({ slug: candidates.slug })
    .from(candidates)
    .where(
      and(
        isNotNull(candidates.aiSummary),
        sql`(${candidates.lastReviewedAt} IS NULL OR ${candidates.lastEnrichedAt} > ${candidates.lastReviewedAt})`,
      ),
    )
    .orderBy(sql`${candidates.lastEnrichedAt} DESC NULLS LAST`);
  return rows.map((r) => r.slug);
}

async function getLastCycleTimestamp(): Promise<string> {
  try {
    const row = await db
      .select({
        lastRun: sql<Date | null>`max(${cronLogs.updatedAt})`,
      })
      .from(cronLogs)
      .then((r) => r[0]);
    return row?.lastRun ? new Date(row.lastRun).toISOString() : "never";
  } catch {
    return "unknown (cron_logs unavailable)";
  }
}

async function triggerRevalidation(): Promise<boolean> {
  if (!REVALIDATION_SECRET) {
    console.log(
      "  ⚠ REVALIDATION_SECRET not set — skipping ISR revalidation (non-fatal)",
    );
    return true;
  }

  const origin = resolveRevalidateOrigin();
  const url = `${origin.replace(/\/$/, "")}/api/revalidate`;

  if (
    origin.includes("127.0.0.1") ||
    origin.includes("localhost")
  ) {
    console.log(`  ℹ Revalidation target: ${url} (local/dev — matches .env.local secret)`);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidation-secret": REVALIDATION_SECRET,
      },
      body: JSON.stringify({ revalidateAll: true }),
    });
    if (res.ok) {
      console.log("  ✓ ISR cache revalidated — changes live on site");
      return true;
    }
    console.error(`  ✗ Revalidation failed: ${res.status}`);
    return false;
  } catch (err) {
    console.error(`  ✗ Revalidation error: ${err}`);
    return false;
  }
}

async function main() {
  const cycleStart = Date.now();
  const since = await getLastCycleTimestamp();
  console.log(`[cycle] Starting — checking for changes since ${since}`);

  // Safety check: verify is_2026 counts are sane before proceeding
  const { active } = await db.select({
    active: sql<number>`COUNT(*) FILTER (WHERE is_2026 = true)`.mapWith(Number),
  }).from(candidates).then(r => r[0]);

  if (active < 85) {
    console.error(`SAFETY ABORT: only ${active} candidates have is_2026=true. Expected ~92. Something reset the flags. Aborting cycle.`);
    process.exit(1);
  }

  const runDate = new Date().toISOString().split("T")[0];

  console.log(`\n${"═".repeat(50)}`);
  console.log(`VotePulse Daily Update Cycle — ${runDate}`);
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN" : FORCE ? "FORCE" : "STANDARD"}`,
  );
  console.log(`${"═".repeat(50)}`);

  const results: Record<string, { ok: boolean; duration: number }> = {};

  console.log("\n── Step 1: Scrape vote.je manifesto pages");
  console.log(`[cycle] Step 1 scrape: starting`);
  const step1Start = Date.now();
  const scrapeResult = await run(
    "npx tsx scripts/scrapers/scrape-vote-je-manifestos.ts",
    "Scraping vote.je for updated 2026 manifesto pages",
  );
  results.scrape = scrapeResult;

  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n── Step 2: Detect candidates pending enrichment");
  const changedSlugs = FORCE
    ? []
    : await getCandidatesNeedingManifestoEnrichment();

  console.log(
    `[cycle] Step 1 scrape: found ${FORCE ? "all" : changedSlugs.length} changed candidates (${formatDuration(Date.now() - step1Start)})`,
  );
  console.log(
    `  Changed candidates: ${FORCE ? "ALL (force mode)" : changedSlugs.length}`,
  );
  if (changedSlugs.length > 0) {
    changedSlugs.forEach((s) => console.log(`    • ${s}`));
  }

  if (FORCE || changedSlugs.length > 0) {
    console.log(
      `[cycle] Step 2 enrich: enriching ${FORCE ? "all" : changedSlugs.length} candidates`,
    );
    console.log("\n── Step 3: Grok enrichment");
    const step2Start = Date.now();

    if (FORCE) {
      const enrichResult = await run(
        "npx tsx scripts/enrich.ts --force --is2026",
        "Grok enrichment (all active 2026 candidates with manifestos)",
      );
      results.enrich = enrichResult;
    } else {
      let allEnrichOk = true;
      let enrichDuration = 0;
      for (const slug of changedSlugs) {
        const enrichResult = await run(
          `npx tsx scripts/enrich.ts --slug=${slug}`,
          `Grok enrichment: ${slug}`,
        );
        enrichDuration += enrichResult.duration;
        if (!enrichResult.ok) allEnrichOk = false;
        await new Promise((r) => setTimeout(r, 3000));
      }
      results.enrich = { ok: allEnrichOk, duration: enrichDuration };
    }
    console.log(`[cycle] Step 2 enrich: done in ${formatDuration(Date.now() - step2Start)}`);
  } else {
    console.log("[cycle] Step 2 enrich: skipped (0 changes)");
    console.log("\n── Step 3: No enrichment needed (no changes detected)");
    results.enrich = { ok: true, duration: 0 };
  }

  console.log("\n── Step 4: Kimi K2.6 supervision");
  const reviewSlugs = await getCandidatesNeedingReview();
  console.log(`[cycle] Step 3 supervise: reviewing ${reviewSlugs.length} candidates`);
  const step3Start = Date.now();
  const superviseResult =
    reviewSlugs.length === 0 && !FORCE
      ? { ok: true, output: "skipped (0 candidates)", duration: 0 }
      : await run(
          "npx tsx scripts/review-summaries.ts",
          "Kimi K2.6 reviewing new/changed summaries",
        );
  results.supervise = superviseResult;
  if (reviewSlugs.length > 0 || FORCE) {
    console.log(`[cycle] Step 3 supervise: done in ${formatDuration(Date.now() - step3Start)}`);
  }

  const shouldRegenTopics =
    FORCE || changedSlugs.length >= TOPIC_REGEN_THRESHOLD;

  if (shouldRegenTopics) {
    console.log(`\n── Step 5: Regenerate topic summaries`);
    console.log(
      `  Reason: ${FORCE ? "force mode" : `${changedSlugs.length} candidates changed`}`,
    );
    const topicsResult = await run(
      "npx tsx scripts/generate-topics.ts",
      "Regenerating policy topic summaries",
    );
    results.topics = topicsResult;
  } else {
    console.log(`\n── Step 5: Skipping topic regeneration`);
    console.log(
      `  (${changedSlugs.length} candidates changed — threshold is ${TOPIC_REGEN_THRESHOLD})`,
    );
    results.topics = { ok: true, duration: 0 };
  }

  console.log("\n── Step 6: Revalidate ISR cache");
  const revalidated = DRY_RUN ? true : await triggerRevalidation();
  results.revalidate = {
    ok: revalidated,
    duration: 0,
  };

  const totalDuration = Date.now() - cycleStart;
  const allOk = Object.values(results).every((r) => r.ok);

  console.log(`\n${"═".repeat(50)}`);
  console.log("CYCLE COMPLETE");
  console.log(`${"═".repeat(50)}`);
  console.log(
    `Status:    ${allOk ? "✓ ALL STEPS PASSED" : "⚠ SOME STEPS FAILED"}`,
  );
  console.log(`Duration:  ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  console.log(
    `Changed:   ${FORCE ? "all (force)" : `${changedSlugs.length}`} candidates`,
  );
  console.log(`Topics:    ${shouldRegenTopics ? "regenerated" : "unchanged"}`);
  console.log(
    `Cache:     ${DRY_RUN ? "dry run (skipped)" : revalidated ? "revalidated" : "not revalidated"}`,
  );
  console.log(`[cycle] Total: ${formatDuration(totalDuration)}`);
  console.log("");

  Object.entries(results).forEach(([step, result]) => {
    const icon = result.ok ? "✓" : "✗";
    const time =
      result.duration > 0 ? ` (${(result.duration / 1000).toFixed(0)}s)` : "";
    console.log(`  ${icon} ${step}${time}`);
  });

  console.log(`${"═".repeat(50)}\n`);

  if (!DRY_RUN) {
    try {
      await db
        .insert(cronLogs)
        .values({
          cycleDate: runDate,
          changedCount: changedSlugs.length,
          allOk,
          durationMs: totalDuration,
          details: { results, changedSlugs, force: FORCE },
        })
        .onConflictDoUpdate({
          target: cronLogs.cycleDate,
          set: {
            changedCount: changedSlugs.length,
            allOk,
            durationMs: totalDuration,
            details: { results, changedSlugs, force: FORCE },
            updatedAt: new Date(),
          },
        });
    } catch {
      // cron_logs table may not exist yet — non-fatal
    }
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("[daily-update] Fatal:", err);
  process.exit(1);
});
