/**
 * VotePulse — Discover Social Links
 *
 * Scans candidates.manifesto_raw text for social media URLs that weren't
 * captured by the existing extract-social-links script. Updates social_links
 * only for candidates that currently have none.
 *
 * Usage:
 *   npx tsx scripts/discover-social-links.ts
 *   npx tsx scripts/discover-social-links.ts --dry-run
 *   npx tsx scripts/discover-social-links.ts --slug=john-smith
 */

import "./bootstrap-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNull, or, sql } from "drizzle-orm";
import { candidates } from "../src/db/schema";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SINGLE_SLUG = args.find((a) => a.startsWith("--slug="))?.split("=")[1];

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[discover-social] ✗ DATABASE_URL not set (.env.local)");
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 2,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { candidates } });

// ── Regex patterns for each platform ─────────────────────────────────────────

const SOCIAL_PATTERNS: Record<string, RegExp[]> = {
  facebook: [
    /https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share|dialog|login|photo|media|video|events|groups|pages\/create)[^\s"'<>)]+/gi,
  ],
  website: [
    /https?:\/\/(?!(?:www\.)?(?:facebook|twitter|instagram|linkedin|youtube|flow\.je|vote\.je|bbc\.co\.uk|itv\.com))[\w-]+\.(?:je|com|co\.uk|org\.uk|net)[^\s"'<>)]*/gi,
  ],
  twitter: [
    /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share|home|explore|i\/)[^\s"'<>)]+/gi,
  ],
  linkedin: [
    /https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s"'<>)]+/gi,
  ],
};

function extractSocialUrls(text: string): Record<string, string> {
  const found: Record<string, string> = {};

  for (const [platform, patterns] of Object.entries(SOCIAL_PATTERNS)) {
    for (const pattern of patterns) {
      // Reset lastIndex between uses of /g regexes
      pattern.lastIndex = 0;
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        const url = matches[0]!.trim().replace(/[.,;:!?)]+$/, "");
        if (url.startsWith("http") && url.length > 15) {
          found[platform] = url;
          break;
        }
      }
    }
  }

  return found;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function discoverSocialLinks() {
  console.log("\n=== Social Link Discovery ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (DRY_RUN) console.log("(No changes will be written)");

  // Build query: candidates with no social links, or a specific slug
  const rows = SINGLE_SLUG
    ? await db
        .select({
          id: candidates.id,
          name: candidates.name,
          slug: candidates.slug,
          manifestoRaw: candidates.manifestoRaw,
          socialLinks: candidates.socialLinks,
        })
        .from(candidates)
        .where(eq(candidates.slug, SINGLE_SLUG))
    : await db
        .select({
          id: candidates.id,
          name: candidates.name,
          slug: candidates.slug,
          manifestoRaw: candidates.manifestoRaw,
          socialLinks: candidates.socialLinks,
        })
        .from(candidates)
        .where(
          or(
            isNull(candidates.socialLinks),
            sql`${candidates.socialLinks} = '{}'::jsonb`,
          ),
        );

  console.log(`Scanning ${rows.length} candidates with no social links...\n`);

  let found = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.manifestoRaw) {
      console.log(`  ${row.name} — no manifesto_raw`);
      skipped++;
      continue;
    }

    const discovered = extractSocialUrls(row.manifestoRaw);

    if (Object.keys(discovered).length === 0) {
      console.log(`  ${row.name} — nothing found`);
      skipped++;
      continue;
    }

    console.log(`  ${row.name} — found:`);
    for (const [platform, url] of Object.entries(discovered)) {
      console.log(`    ${platform}: ${url}`);
    }

    if (!DRY_RUN) {
      await db
        .update(candidates)
        .set({
          socialLinks: discovered,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, row.id));
    }

    found++;
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`  Found:   ${found}`);
  console.log(`  Skipped: ${skipped}`);
  if (DRY_RUN) console.log("  [DRY RUN] No changes written.");
  console.log("===============\n");

  await pgClient.end({ timeout: 5 });
  process.exit(0);
}

discoverSocialLinks().catch(async (err) => {
  console.error("[discover-social] Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
