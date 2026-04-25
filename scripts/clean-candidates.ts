/**
 * VotePulse — One-time data quality pass over all existing candidates.
 *
 * Detects dirty scraped data (emails in names, nav text in bio/manifesto)
 * and runs the AI cleaner on affected records.
 *
 * Usage:
 *   npx tsx scripts/clean-candidates.ts              # clean dirty ones only
 *   npx tsx scripts/clean-candidates.ts --dry-run    # preview without DB writes
 *   npx tsx scripts/clean-candidates.ts --all        # clean all candidates
 *   npx tsx scripts/clean-candidates.ts --slug=john-smith
 */

import "./bootstrap-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { candidates } from "../src/db/schema";
import {
  cleanCandidateData,
  looksLikeDirtyData,
} from "../src/lib/candidate-cleaner";

// ── Bootstrap ────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[clean-candidates] ✗ DATABASE_URL not set");
  process.exit(1);
}

const GROK_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
if (!GROK_KEY?.trim()) {
  console.error(
    "[clean-candidates] ✗ GROK_API_KEY (or XAI_API_KEY) not set",
  );
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient);

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const CLEAN_ALL = args.includes("--all");
const SINGLE_SLUG = args.find((a) => a.startsWith("--slug="))?.split("=")[1];
const DELAY_MS = 1500;

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== VotePulse Candidate Data Cleaner ===");
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN (no DB writes)" : "LIVE (will update DB)"}`,
  );
  if (SINGLE_SLUG) console.log(`Targeting: ${SINGLE_SLUG}`);
  if (CLEAN_ALL) console.log("Cleaning ALL candidates (--all flag)");
  console.log("");

  // Fetch candidates
  let allCandidates: Array<{
    id: string;
    name: string;
    slug: string;
    bio: string | null;
    manifestoRaw: string | null;
    manifestoUrl: string | null;
    sourceUrls: string[];
  }>;

  if (SINGLE_SLUG) {
    allCandidates = await db
      .select({
        id: candidates.id,
        name: candidates.name,
        slug: candidates.slug,
        bio: candidates.bio,
        manifestoRaw: candidates.manifestoRaw,
        manifestoUrl: candidates.manifestoUrl,
        sourceUrls: candidates.sourceUrls,
      })
      .from(candidates)
      .where(eq(candidates.slug, SINGLE_SLUG));

    if (allCandidates.length === 0) {
      console.error(`No candidate found with slug "${SINGLE_SLUG}"`);
      await pgClient.end({ timeout: 5 });
      process.exit(1);
    }
  } else {
    allCandidates = await db
      .select({
        id: candidates.id,
        name: candidates.name,
        slug: candidates.slug,
        bio: candidates.bio,
        manifestoRaw: candidates.manifestoRaw,
        manifestoUrl: candidates.manifestoUrl,
        sourceUrls: candidates.sourceUrls,
      })
      .from(candidates);
  }

  console.log(`Found ${allCandidates.length} candidates to check\n`);

  let checked = 0;
  let dirty = 0;
  let cleaned = 0;
  let unchanged = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of allCandidates) {
    checked++;
    const prefix = `[${checked}/${allCandidates.length}] ${candidate.name}`;

    const needsCleaning =
      CLEAN_ALL ||
      looksLikeDirtyData(candidate.name, candidate.bio, candidate.manifestoRaw);

    if (!needsCleaning) {
      process.stdout.write(`  ${prefix} — ✓ clean\n`);
      skipped++;
      continue;
    }

    dirty++;
    console.log(`  ${prefix} — ⚠ dirty data detected`);

    if (candidate.name.includes("@")) {
      console.log(`    → Email in name: ${candidate.name}`);
    }
    if (candidate.name.length > 60) {
      console.log(
        `    → Name too long (${candidate.name.length} chars): "${candidate.name.slice(0, 80)}..."`,
      );
    }

    if (DRY_RUN) {
      console.log(`    → [DRY RUN] Would clean this candidate`);
      continue;
    }

    try {
      const result = await cleanCandidateData({
        rawName: candidate.name,
        rawBio: candidate.bio,
        rawManifesto: candidate.manifestoRaw,
        sourceUrl: candidate.manifestoUrl ?? (candidate.sourceUrls[0] ?? null),
      });

      if (result.wasModified) {
        if (result.name !== candidate.name) {
          console.log(
            `    → Name: "${candidate.name}" → "${result.name}"`,
          );
        }
        if (result.issues.length > 0) {
          console.log(`    → Issues fixed: ${result.issues.join(", ")}`);
        }

        await db
          .update(candidates)
          .set({
            name: result.name,
            bio: result.bio,
            manifestoRaw: result.manifestoRaw,
            updatedAt: new Date(),
          })
          .where(eq(candidates.id, candidate.id));

        // If name changed, try to update slug
        if (result.name !== candidate.name) {
          const newSlug = result.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");

          if (newSlug && newSlug !== candidate.slug) {
            const existing = await db
              .select({ id: candidates.id })
              .from(candidates)
              .where(eq(candidates.slug, newSlug))
              .limit(1);

            if (existing.length === 0) {
              await db
                .update(candidates)
                .set({ slug: newSlug })
                .where(eq(candidates.id, candidate.id));
              console.log(
                `    → Slug: "${candidate.slug}" → "${newSlug}"`,
              );
            }
          }
        }

        console.log(`    ✓ Updated`);
        cleaned++;
      } else {
        console.log(`    → No changes needed after cleaning`);
        unchanged++;
      }

      await new Promise((r) => setTimeout(r, DELAY_MS));
    } catch (err) {
      console.error(`    ✗ Failed: ${err}`);
      failed++;
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`  Total checked:  ${checked}`);
  console.log(`  Dirty detected: ${dirty}`);
  console.log(`  Cleaned:        ${cleaned}`);
  console.log(`  Unchanged:      ${unchanged}`);
  console.log(`  Skipped:        ${skipped}`);
  console.log(`  Failed:         ${failed}`);
  if (DRY_RUN) {
    console.log("\n  [DRY RUN] No changes were written to the database.");
    console.log("  Remove --dry-run to apply changes.");
  }
  console.log("===============\n");

  await pgClient.end({ timeout: 5 });
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[clean-candidates] Fatal error:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
