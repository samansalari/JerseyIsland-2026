/**
 * VotePulse — Manifesto Cleaner (one-off / repeatable)
 *
 * Re-runs `cleanManifestoForStorage` over every candidate's `manifestoRaw`
 * to retroactively strip vote.je nav / flow.je boilerplate / SVG icon-label
 * noise that's already in the DB.
 *
 * Usage:
 *   npm run clean:manifestos:dry         # report-only, no writes
 *   npm run clean:manifestos             # apply
 *   npx tsx scripts/clean-manifesto-data.ts --slug=cameron-monro
 *
 * Flags:
 *   --dry-run        Preview the cleanup without writing.
 *   --slug=<slug>    Restrict to a single candidate slug.
 */

import "./bootstrap-env";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNotNull } from "drizzle-orm";
import { candidates } from "../src/db/schema";
import { cleanManifestoForStorage } from "../src/lib/clean-manifesto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[clean-manifesto] ✗ DATABASE_URL not set (.env.local)");
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SLUG = args.find((a) => a.startsWith("--slug="))?.split("=")[1];

const pgClient = postgres(DATABASE_URL, {
  max: 2,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { candidates } });

async function main() {
  console.log("\n=== Manifesto Cleaner ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (SLUG) console.log(`Slug filter: ${SLUG}`);
  console.log("");

  // Always scan every candidate with a non-null manifesto (cheap — ~200
  // rows). Filtering by a substring like "%icon%" misses orphan-word
  // artefacts that survive earlier cleaning passes.
  const where = SLUG ? eq(candidates.slug, SLUG) : isNotNull(candidates.manifestoRaw);

  const rows = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      slug: candidates.slug,
      manifestoRaw: candidates.manifestoRaw,
    })
    .from(candidates)
    .where(where);

  console.log(`Candidates to check: ${rows.length}\n`);

  let cleaned = 0;
  let unchanged = 0;
  let totalRemoved = 0;

  for (const row of rows) {
    if (!row.manifestoRaw) continue;

    const original = row.manifestoRaw;
    const cleanedText = cleanManifestoForStorage(original);

    if (cleanedText === original) {
      unchanged++;
      continue;
    }

    const removed = original.length - cleanedText.length;
    totalRemoved += removed;

    console.log(`  ${row.slug.padEnd(32)}  ${original.length} → ${cleanedText.length}  (-${removed})`);

    const hadIcon = /icon/i.test(original) && !/\w+\s+icon/i.test(cleanedText);
    const hadParticipated = /has participated in \d+ election/i.test(original);
    const flags: string[] = [];
    if (hadIcon) flags.push("icons");
    if (hadParticipated && !/has participated in \d+ election/i.test(cleanedText)) {
      flags.push("election-stat");
    }
    if (flags.length) console.log(`      removed: ${flags.join(", ")}`);

    if (!DRY_RUN) {
      await db
        .update(candidates)
        .set({
          manifestoRaw: cleanedText,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, row.id));
    }

    cleaned++;
  }

  console.log("\n=== RESULTS ===");
  console.log(`  Cleaned       : ${cleaned}`);
  console.log(`  Unchanged     : ${unchanged}`);
  console.log(`  Chars removed : ${totalRemoved.toLocaleString()}`);
  if (DRY_RUN) console.log("  [DRY RUN] No changes written.");
  console.log("================\n");

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[clean-manifesto] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
