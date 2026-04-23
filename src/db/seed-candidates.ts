import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { db, sql as pgClient } from "./index";
import { candidates } from "./schema";
import { sql } from "drizzle-orm";

/**
 * Seed candidates from `data/candidates.json`.
 *
 * - Auto-generates `slug` from name (lowercase, hyphenated, ASCII).
 * - Auto-generates `data_hash` (SHA-256 of `manifesto_raw`).
 * - Upserts on `slug` — safe to re-run after editing the JSON.
 * - Logs inserted vs updated counts.
 *
 * Usage:
 *   pnpm db:seed:candidates
 *   tsx src/db/seed-candidates.ts
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Slugify a candidate name: "Marie Le Breton" → "marie-le-breton" */
function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** SHA-256 hex digest (returns null if input is nullish/empty). */
function sha256(text: string | null | undefined): string | null {
  if (!text) return null;
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ── JSON shape ──────────────────────────────────────────────────────────────

interface CandidateInput {
  name: string;
  district: string;
  party: string | null;
  photo_url: string | null;
  bio: string | null;
  manifesto_raw: string | null;
  manifesto_url: string | null;
  source_urls: string[];
}

const VALID_DISTRICTS = new Set([
  "St Helier North",
  "St Helier Central",
  "St Helier South",
  "St Saviour",
  "St Brelade",
  "St Clement",
  "St Peter",
  "St Lawrence",
  "St Mary",
  "St Ouen",
  "St John",
  "Trinity",
  "Grouville",
  "St Martin",
]);

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = join(process.cwd(), "data", "candidates.json");
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    console.error(`[seed:candidates] ✗ Could not read ${filePath}`);
    console.error(`  Create data/candidates.json first (see the starter template).`);
    process.exit(1);
  }

  const entries: CandidateInput[] = JSON.parse(raw);

  if (!Array.isArray(entries) || entries.length === 0) {
    console.error("[seed:candidates] ✗ candidates.json is empty or not an array.");
    process.exit(1);
  }

  // Validate districts up-front so typos don't slip in.
  for (const entry of entries) {
    if (!VALID_DISTRICTS.has(entry.district)) {
      console.error(
        `[seed:candidates] ✗ Unknown district "${entry.district}" for "${entry.name}".`,
      );
      console.error(`  Valid: ${[...VALID_DISTRICTS].sort().join(", ")}`);
      process.exit(1);
    }
  }

  console.log(`[seed:candidates] processing ${entries.length} candidates…`);

  let inserted = 0;
  let updated = 0;

  for (const entry of entries) {
    const slug = slugify(entry.name);
    const dataHash = sha256(entry.manifesto_raw);
    const now = new Date();

    const result = await db
      .insert(candidates)
      .values({
        name: entry.name,
        slug,
        district: entry.district,
        party: entry.party,
        photoUrl: entry.photo_url,
        bio: entry.bio,
        manifestoRaw: entry.manifesto_raw,
        manifestoUrl: entry.manifesto_url,
        sourceUrls: entry.source_urls,
        dataHash,
        lastScrapedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: candidates.slug,
        set: {
          name: sql`excluded.name`,
          district: sql`excluded.district`,
          party: sql`excluded.party`,
          photoUrl: sql`excluded.photo_url`,
          bio: sql`excluded.bio`,
          manifestoRaw: sql`excluded.manifesto_raw`,
          manifestoUrl: sql`excluded.manifesto_url`,
          sourceUrls: sql`excluded.source_urls`,
          dataHash: sql`excluded.data_hash`,
          lastScrapedAt: sql`excluded.last_scraped_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning({ id: candidates.id, created: candidates.createdAt });

    const row = result[0];
    if (!row) continue;

    // If createdAt ≈ now (within 1s), this was an INSERT; otherwise UPDATE.
    const isNew = Math.abs(row.created.getTime() - now.getTime()) < 1000;
    if (isNew) {
      inserted++;
      console.log(`  + ${slug} (${entry.district}) — inserted`);
    } else {
      updated++;
      console.log(`  ~ ${slug} (${entry.district}) — updated`);
    }
  }

  const total = await db.$count(candidates);
  console.log(
    `[seed:candidates] ✓ done: ${inserted} inserted, ${updated} updated, ${total} total in DB`,
  );

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[seed:candidates] ✗", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
