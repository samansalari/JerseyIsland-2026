import "./bootstrap-env";
import { db } from "../src/db";
import { candidates } from "../src/db/schema";
import { eq, ilike, inArray } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  OFFICIAL_2026_CANDIDATES,
  type OfficialCandidate,
} from "./data/official-2026-candidates";

/**
 * VotePulse — Sync DB candidates to the official 2026 vote.je list.
 *
 * Reads the hardcoded `OFFICIAL_2026_CANDIDATES` array (single source of
 * truth) and reconciles it against the `candidates` table:
 *
 *   - DB rows missing from the official list  → ARCHIVE   (is_2026 = false)
 *   - Official rows missing from the DB        → INSERT    (is_2026 = true)
 *   - Rows in both                              → UPDATE    name / role /
 *                                                          district / party /
 *                                                          manifestoUrl /
 *                                                          is_2026 = true
 *
 * Matching strategy (in order):
 *   1. Exact slug match: DB.slug === nameToSlug(official.name)
 *   2. Case-insensitive name match: DB.name ILIKE official.name
 *   3. Last-name-only match as a fallback, only when unambiguous
 *
 * Ambiguous last-name matches are left alone — better to insert a duplicate
 * that an admin can manually merge than to overwrite the wrong record.
 *
 * Usage:
 *   npx tsx scripts/sync-official-candidates.ts --dry-run
 *   npx tsx scripts/sync-official-candidates.ts
 */

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ARCHIVE_ONLY = args.includes("--archive-only");

// ── DB client (avoid pulling in @/lib/env which validates many envs) ─────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[sync] ✗ DATABASE_URL not set");
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
const localDb = drizzle(pgClient, { schema: { candidates } });
// Use the script-local client so the bootstrap-env values are picked up;
// fall back to the shared `db` only if it has been pre-imported elsewhere.
void db;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Slugify a candidate name to match the existing DB convention.
 * Mirrors the rules used by `scripts/seed-candidates.ts` (NFKD normalise →
 * strip diacritics → lowercase → dash-separate). Crucially, this turns
 * "Beatriz Porée" into `beatriz-poree`, "John Le Fondré" into
 * `john-le-fondre`, "Sam Mézec" into `sam-mezec`, and so on, regardless of
 * the slug suffix that vote.je happens to use for that election year.
 */
function nameToSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Convert a vote.je district string ("St. Helier", null for senators) into
 * the value we want to store. The DB's existing rows use the no-period
 * "St Helier" form and senators carry the literal "Island-wide (Senator)"
 * because `district` is NOT NULL.
 */
function normaliseDistrict(district: string | null): string {
  if (district === null) return "Island-wide (Senator)";
  return district.replace(/\bSt\./g, "St");
}

interface DbRow {
  id: string;
  name: string;
  slug: string;
  district: string;
  party: string | null;
  role: "Senator" | "Deputy" | "Connétable" | null;
  is2026: boolean;
  manifestoUrl: string | null;
}

interface UpdatePlan {
  dbRow: DbRow;
  official: OfficialCandidate;
  changes: Record<string, unknown>;
}

const candidateSelect = {
  id: candidates.id,
  name: candidates.name,
  slug: candidates.slug,
  district: candidates.district,
  party: candidates.party,
  role: candidates.role,
  is2026: candidates.is2026,
  manifestoUrl: candidates.manifestoUrl,
};

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function lastNameOf(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name.trim();
}

function firstUnclaimed(rows: DbRow[], claimedIds: Set<string>): DbRow | null {
  return rows.find((row) => !claimedIds.has(row.id)) ?? null;
}

function buildChanges(row: DbRow, official: OfficialCandidate) {
  const desiredDistrict = normaliseDistrict(official.district);
  const changes: Record<string, unknown> = {};

  if (official.name !== row.name) changes.name = official.name;
  if (official.role !== row.role) changes.role = official.role;
  if (desiredDistrict !== row.district) changes.district = desiredDistrict;
  if (official.party !== row.party) changes.party = official.party;
  if (row.manifestoUrl !== official.voteJeUrl) {
    changes.manifestoUrl = official.voteJeUrl;
  }
  if (!row.is2026) changes.is2026 = true;

  return changes;
}

async function findDbMatchForOfficial(
  official: OfficialCandidate,
  claimedIds: Set<string>,
): Promise<DbRow | null> {
  const officialSlug = nameToSlug(official.name);

  const slugMatches = await localDb
    .select(candidateSelect)
    .from(candidates)
    .where(eq(candidates.slug, officialSlug));
  const slugMatch = firstUnclaimed(slugMatches, claimedIds);
  if (slugMatch) return slugMatch;

  const nameMatches = await localDb
    .select(candidateSelect)
    .from(candidates)
    .where(ilike(candidates.name, escapeLikePattern(official.name)));
  const nameMatch = firstUnclaimed(nameMatches, claimedIds);
  if (nameMatch) return nameMatch;

  const lastName = lastNameOf(official.name);
  const lastNameMatches = (
    await localDb
      .select(candidateSelect)
      .from(candidates)
      .where(ilike(candidates.name, `% ${escapeLikePattern(lastName)}`))
  ).filter((row) => !claimedIds.has(row.id));

  if (lastNameMatches.length === 1) {
    return lastNameMatches[0]!;
  }
  if (lastNameMatches.length > 1) {
    console.warn(
      `[sync] Ambiguous last-name fallback for ${official.name}: ${lastNameMatches.map((row) => row.name).join(", ")}`,
    );
  }

  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== VotePulse Official Candidate Sync ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (ARCHIVE_ONLY) console.log("Sub-mode: ARCHIVE ONLY (no updates/inserts)");
  console.log(`Official 2026 candidates: ${OFFICIAL_2026_CANDIDATES.length}\n`);

  // ── Load DB rows ───────────────────────────────────────────────────────────

  const dbCandidates: DbRow[] = await localDb
    .select(candidateSelect)
    .from(candidates);

  console.log(`DB candidates: ${dbCandidates.length}\n`);

  // ── Match official rows to DB rows ─────────────────────────────────────────

  const toUpdate: UpdatePlan[] = [];
  const alreadyCorrect: DbRow[] = [];
  const matchedOfficials = new Set<OfficialCandidate>();
  const matchedDbIds = new Set<string>();

  for (const official of OFFICIAL_2026_CANDIDATES) {
    const row = await findDbMatchForOfficial(official, matchedDbIds);
    if (!row) {
      continue;
    }

    matchedOfficials.add(official);
    matchedDbIds.add(row.id);

    const changes = buildChanges(row, official);
    if (Object.keys(changes).length > 0) {
      toUpdate.push({ dbRow: row, official, changes });
    } else {
      alreadyCorrect.push(row);
    }
  }

  const toInsert = OFFICIAL_2026_CANDIDATES.filter(
    (c) => !matchedOfficials.has(c),
  );
  const toArchive = dbCandidates.filter((row) => !matchedDbIds.has(row.id));

  // ── Report ─────────────────────────────────────────────────────────────────

  console.log("--- SUMMARY ---");
  console.log(`  To archive (not in 2026):            ${toArchive.length}`);
  console.log(`  To update (name/role/party/etc.):    ${toUpdate.length}`);
  console.log(`  Already correct:                      ${alreadyCorrect.length}`);
  console.log(`  New (insert):                         ${toInsert.length}`);

  console.log(`\n--- ARCHIVE (${toArchive.length}) ---`);
  for (const c of toArchive) console.log(`  - ${c.name} (${c.slug})`);

  console.log(`\n--- UPDATES (${toUpdate.length}) ---`);
  for (const { dbRow, changes } of toUpdate) {
    console.log(`  ${dbRow.name} (${dbRow.slug}):`);
    for (const [k, v] of Object.entries(changes)) {
      const before = (dbRow as unknown as Record<string, unknown>)[k];
      console.log(`    ${k}: ${formatValue(before)} → ${formatValue(v)}`);
    }
  }

  console.log(`\n--- NEW CANDIDATES (${toInsert.length}) ---`);
  for (const c of toInsert) {
    console.log(
      `  + ${c.name} (${c.role}, ${c.district ?? "Island-wide (Senator)"})`,
    );
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No changes written.\n");
    await pgClient.end({ timeout: 5 });
    process.exit(0);
  }

  // ── Apply: archive ─────────────────────────────────────────────────────────

  if (toArchive.length > 0) {
    const archiveIds = toArchive.map((c) => c.id);
    await localDb
      .update(candidates)
      .set({ is2026: false, updatedAt: new Date() })
      .where(inArray(candidates.id, archiveIds));
    console.log(`\nArchived ${toArchive.length} non-2026 candidates`);
  }

  if (ARCHIVE_ONLY) {
    console.log("\n[ARCHIVE-ONLY] Skipping updates and inserts.\n");
    await pgClient.end({ timeout: 5 });
    process.exit(0);
  }

  // ── Apply: updates ─────────────────────────────────────────────────────────

  for (const { dbRow, changes } of toUpdate) {
    await localDb
      .update(candidates)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(candidates.id, dbRow.id));
  }
  console.log(`Updated ${toUpdate.length} candidates`);

  // ── Apply: inserts ─────────────────────────────────────────────────────────

  let insertedCount = 0;
  for (const c of toInsert) {
    const slug = nameToSlug(c.name);
    const district = normaliseDistrict(c.district);
    await localDb.insert(candidates).values({
      name: c.name,
      slug,
      district,
      party: c.party,
      role: c.role,
      is2026: true,
      manifestoUrl: c.voteJeUrl,
      sourceUrls: [c.voteJeUrl],
      bio: null,
      manifestoRaw: null,
      aiSummary: null,
      aiIssues: [],
      updatedAt: new Date(),
      createdAt: new Date(),
    });
    console.log(`  Inserted: ${c.name} (${c.role}, ${district})`);
    insertedCount++;
  }

  console.log("\n=== SYNC COMPLETE ===");
  console.log(
    `Final 2026 candidate count: ${OFFICIAL_2026_CANDIDATES.length} (archived: ${toArchive.length})`,
  );
  console.log("Next steps:");
  console.log("  1. npm run scrape:manifestos  ← scrape new vote.je 2026 pages");
  console.log("  2. npm run enrich:batch       ← enrich new candidates");
  console.log("  3. Verify /admin/candidates and /candidates");

  await pgClient.end({ timeout: 5 });
  process.exit(0);
}

function formatValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}

main().catch(async (err) => {
  console.error("[sync] Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
