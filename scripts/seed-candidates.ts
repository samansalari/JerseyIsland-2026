import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import { candidates } from "../src/db/schema";

/**
 * VotePulse — Candidate Seed Script
 *
 * Reads data/candidates.json (real, manually-collected data) and upserts
 * into the candidates table. Safe to re-run — detects inserts vs updates
 * and logs manifesto changes.
 *
 * Usage:
 *   npx tsx scripts/seed-candidates.ts
 *   pnpm seed:candidates
 */

// ── Bootstrap ───────────────────────────────────────────────────────────────

const { config } = await import("dotenv");
config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[seed] ✗ DATABASE_URL not set");
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { candidates } });

// ── Constants ───────────────────────────────────────────────────────────────

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

// ── Types ───────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sha256(text: string | null | undefined): string | null {
  if (!text) return null;
  return createHash("sha256").update(text, "utf8").digest("hex");
}

interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function validate(entry: CandidateInput, index: number): ValidationResult {
  const errors: string[] = [];
  const prefix = `[${index}]`;

  if (!entry.name || typeof entry.name !== "string" || !entry.name.trim()) {
    errors.push(`${prefix} name is required and must be non-empty`);
  }

  if (!VALID_DISTRICTS.has(entry.district)) {
    errors.push(
      `${prefix} "${entry.district}" is not a valid district. Valid: ${[...VALID_DISTRICTS].sort().join(", ")}`,
    );
  }

  if (
    !Array.isArray(entry.source_urls) ||
    entry.source_urls.length === 0 ||
    entry.source_urls.some((u) => typeof u !== "string" || !u.trim())
  ) {
    errors.push(
      `${prefix} source_urls must be a non-empty array of URL strings`,
    );
  }

  if (entry.manifesto_raw && !entry.manifesto_url) {
    errors.push(
      `${prefix} manifesto_url is required when manifesto_raw is provided`,
    );
  }

  return { ok: errors.length === 0, errors };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = join(process.cwd(), "data", "candidates.json");
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    console.error(`[seed] ✗ Could not read ${filePath}`);
    console.error(`  Create data/candidates.json first.`);
    process.exit(1);
  }

  // Strip leading comment block (JSON doesn't support comments, but the
  // file template has one — we parse only the array at the end)
  const jsonStart = raw.indexOf("[");
  if (jsonStart === -1) {
    console.error("[seed] ✗ candidates.json does not contain a JSON array.");
    process.exit(1);
  }

  const entries: CandidateInput[] = JSON.parse(raw.slice(jsonStart));

  if (!Array.isArray(entries)) {
    console.error("[seed] ✗ candidates.json root must be an array.");
    process.exit(1);
  }

  if (entries.length === 0) {
    console.log("[seed] candidates.json is empty — nothing to seed.");
    console.log(
      "  Fill it with real candidate data, then run this script again.",
    );
    await pgClient.end({ timeout: 5 });
    return;
  }

  console.log(`[seed] Validating ${entries.length} candidate(s)…\n`);

  // Validate all up-front
  const validEntries: { entry: CandidateInput; index: number }[] = [];
  let validationFailures = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const result = validate(entry, i);
    if (!result.ok) {
      validationFailures++;
      for (const err of result.errors) {
        console.error(`  ✗ ${entry.name || "(unnamed)"}: ${err}`);
      }
    } else {
      validEntries.push({ entry, index: i });
    }
  }

  if (validationFailures > 0) {
    console.log(
      `\n  ${validationFailures} candidate(s) failed validation — fix and re-run.`,
    );
  }

  if (validEntries.length === 0) {
    console.log("[seed] No valid entries to process.");
    await pgClient.end({ timeout: 5 });
    return;
  }

  console.log(`\n[seed] Processing ${validEntries.length} valid candidate(s)…\n`);

  let inserted = 0;
  let updated = 0;

  for (const { entry } of validEntries) {
    const slug = slugify(entry.name);
    const dataHash = sha256(entry.manifesto_raw);
    const now = new Date();

    // Check if exists
    const [existing] = await db
      .select({
        id: candidates.id,
        dataHash: candidates.dataHash,
      })
      .from(candidates)
      .where(eq(candidates.slug, slug))
      .limit(1);

    if (!existing) {
      // INSERT
      await db.insert(candidates).values({
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
      });
      console.log(`  + Inserted: ${entry.name} (${entry.district})`);
      inserted++;
    } else {
      // UPDATE
      const manifestoChanged =
        dataHash !== null &&
        existing.dataHash !== null &&
        dataHash !== existing.dataHash;

      await db
        .update(candidates)
        .set({
          name: entry.name,
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
        .where(eq(candidates.id, existing.id));

      if (manifestoChanged) {
        console.log(
          `  ~ Updated: ${entry.name} (manifesto changed)`,
        );
      } else {
        console.log(`  ~ Updated: ${entry.name} (${entry.district})`);
      }
      updated++;
    }
  }

  const [countRow] = await pgClient<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM candidates
  `;
  const total = countRow?.n ?? 0;

  console.log(`\n[seed] ══════════════════════════════════════`);
  console.log(`[seed] Inserted:           ${inserted}`);
  console.log(`[seed] Updated:            ${updated}`);
  console.log(`[seed] Skipped (invalid):  ${validationFailures}`);
  console.log(`[seed] Total in DB:        ${total}`);
  console.log(`[seed] ══════════════════════════════════════`);

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[seed] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
