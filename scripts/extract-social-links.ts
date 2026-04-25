/**
 * VotePulse — Extract Social Links
 *
 * Parses each candidate's manifesto_raw for social/web links
 * (Twitter/X, Facebook, personal website, Wikipedia, YouTube)
 * and writes them into the social_links JSONB column.
 *
 * Usage:
 *   npx tsx scripts/extract-social-links.ts
 *   npx tsx scripts/extract-social-links.ts --dry-run
 */

import "./bootstrap-env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { candidates } from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[social] ✗ DATABASE_URL not set (.env.local)");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
if (DRY_RUN) console.log("[social] ── DRY RUN MODE ──\n");

const pgClient = postgres(DATABASE_URL, { max: 2, idle_timeout: 20, prepare: false });
const db = drizzle(pgClient, { schema: { candidates } });

// ── Extractor ────────────────────────────────────────────────────────────────

type SocialLinks = Record<string, string>;

/**
 * Parse "Links for <Name>:\n- Platform : handle/url" blocks.
 * Also scans inline URLs for Twitter, Facebook, YouTube, Wikipedia.
 */
function extractSocialLinks(markdown: string): SocialLinks {
  const links: SocialLinks = {};

  // ── 1. Explicit "Links for …:" block ──────────────────────────────────────
  const linksSectionMatch = markdown.match(
    /Links\s+for\s+.+?:\n((?:\s*[-*]\s+.+\n?)+)/i,
  );
  if (linksSectionMatch) {
    for (const line of linksSectionMatch[1].split("\n")) {
      const m = line.match(/^\s*[-*]\s+(\w[\w\s]*):\s*(.+)$/);
      if (!m) continue;
      const platform = m[1].trim().toLowerCase().replace(/\s+/g, "_");
      const value = m[2].trim();
      if (value) links[platform] = value;
    }
  }

  // ── 2. Inline URL scanning ─────────────────────────────────────────────────
  const urlPattern = /https?:\/\/[^\s\)\]>'"]+/g;
  const allUrls = markdown.match(urlPattern) ?? [];

  for (const url of allUrls) {
    const clean = url.replace(/[.,;:!?)]+$/, ""); // strip trailing punctuation

    if (!links.twitter && /twitter\.com\//i.test(clean)) {
      links.twitter = clean;
    }
    if (!links.x && /\bx\.com\//i.test(clean)) {
      links.x = clean;
    }
    if (!links.facebook && /facebook\.com\//i.test(clean)) {
      links.facebook = clean;
    }
    if (!links.youtube && /youtube\.com\//i.test(clean)) {
      links.youtube = clean;
    }
    if (!links.wikipedia && /wikipedia\.org\//i.test(clean)) {
      links.wikipedia = clean;
    }
    if (!links.linkedin && /linkedin\.com\//i.test(clean)) {
      links.linkedin = clean;
    }
  }

  // ── 3. Handle @ handles that aren't full URLs ──────────────────────────────
  // e.g. "Twitter : @AndyJehan"
  if (links.twitter && !links.twitter.startsWith("http")) {
    const handle = links.twitter.replace(/^@/, "");
    links.twitter = `https://twitter.com/${handle}`;
  }
  if (links.x && !links.x.startsWith("http")) {
    const handle = links.x.replace(/^@/, "");
    links.x = `https://x.com/${handle}`;
  }

  // Normalise facebook @-handles like @Jehan4StJohn-101812145858877
  if (links.facebook && !links.facebook.startsWith("http")) {
    const handle = links.facebook.replace(/^@/, "");
    links.facebook = `https://www.facebook.com/${handle}`;
  }

  // ── 4. Scan for bare website hints in "Links for" section or meta fields ───
  const websitePatterns = [
    /(?:website|web|site|homepage|home\s+page)[:\s]+<?(https?:\/\/[^\s>]+)>?/i,
    /(?:website|web|site|homepage|home\s+page)[:\s]+(www\.[^\s]+)/i,
  ];
  for (const pat of websitePatterns) {
    const m = markdown.match(pat);
    if (m && !links.website) {
      let url = m[1].trim();
      if (!url.startsWith("http")) url = `https://${url}`;
      links.website = url;
      break;
    }
  }

  // ── 5. Deduplicate twitter/x – keep twitter if both point to same handle ───
  if (links.twitter && links.x) {
    const tHandle = links.twitter.split("/").pop()?.replace(/^@/, "").toLowerCase();
    const xHandle = links.x.split("/").pop()?.replace(/^@/, "").toLowerCase();
    if (tHandle && tHandle === xHandle) {
      delete links.x; // keep twitter key only
    }
  }

  return links;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const rows = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      manifestoRaw: candidates.manifestoRaw,
      manifestoUrl: candidates.manifestoUrl,
    })
    .from(candidates);

  console.log(`\n=== SOCIAL LINK EXTRACTION ===`);
  console.log(`Processing ${rows.length} candidates\n`);

  const stats = { withLinks: 0, empty: 0, updated: 0 };
  const platformCounts: Record<string, number> = {};

  for (const row of rows) {
    const text = [row.manifestoRaw ?? "", row.manifestoUrl ?? ""].join("\n");
    const links = extractSocialLinks(text);

    const hasLinks = Object.keys(links).length > 0;
    if (hasLinks) {
      stats.withLinks++;
      for (const platform of Object.keys(links)) {
        platformCounts[platform] = (platformCounts[platform] ?? 0) + 1;
      }
      console.log(`  ✓ ${row.name.padEnd(30)} ${JSON.stringify(links)}`);
    } else {
      stats.empty++;
    }

    if (!DRY_RUN) {
      await db
        .update(candidates)
        .set({ socialLinks: hasLinks ? links : null })
        .where(eq(candidates.id, row.id));
      if (hasLinks) stats.updated++;
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`  Candidates with social links : ${stats.withLinks}`);
  console.log(`  Candidates with no links     : ${stats.empty}`);
  if (!DRY_RUN) console.log(`  DB rows updated              : ${stats.updated}`);

  console.log(`\n=== PLATFORM BREAKDOWN ===`);
  const sorted = Object.entries(platformCounts).sort(([, a], [, b]) => b - a);
  for (const [platform, count] of sorted) {
    console.log(`  ${platform.padEnd(20)} ${count}`);
  }

  await pgClient.end({ timeout: 5 });
}

main().catch(async (e) => {
  console.error(e);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
