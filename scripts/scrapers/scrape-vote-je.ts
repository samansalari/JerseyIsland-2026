import Firecrawl from "@mendable/firecrawl-js";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { candidates, snapshots } from "../../src/db/schema";

/**
 * VotePulse — vote.je Candidate Scraper
 *
 * Supplements flow.je data with candidate profiles from vote.je.
 * Cross-references existing DB records by name, merges source URLs,
 * and never overwrites with less data.
 *
 * Usage:
 *   npx tsx scripts/scrapers/scrape-vote-je.ts
 *   npx tsx scripts/scrapers/scrape-vote-je.ts --dry-run
 *
 * Requires:
 *   FIRECRAWL_API_KEY and DATABASE_URL in .env.local
 */

// ── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = "https://www.vote.je/";
const MIN_EXPECTED_CANDIDATES = 10;

// ── Bootstrap ───────────────────────────────────────────────────────────────

const { config } = await import("dotenv");
config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!DATABASE_URL) { console.error("[vote.je] ✗ DATABASE_URL not set"); process.exit(1); }
if (!FIRECRAWL_API_KEY) { console.error("[vote.je] ✗ FIRECRAWL_API_KEY not set"); process.exit(1); }

const DRY_RUN = process.argv.includes("--dry-run");
if (DRY_RUN) console.log("[vote.je] ── DRY RUN MODE ──\n");

const pgClient = postgres(DATABASE_URL, { max: 3, idle_timeout: 20, prepare: false });
const db = drizzle(pgClient, { schema: { candidates, snapshots } });
const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });

// ── Types ───────────────────────────────────────────────────────────────────

type RawCandidate = {
  name: string;
  district: string;
  party: string | null;
  bio: string | null;
  manifesto_raw: string | null;
  manifesto_url: string | null;
  photo_url: string | null;
  source_urls: string[];
};

// ── Districts ───────────────────────────────────────────────────────────────

const VALID_DISTRICTS = new Set([
  "St Helier North", "St Helier Central", "St Helier South", "St Saviour",
  "St Brelade", "St Clement", "St Peter", "St Lawrence", "St Mary",
  "St Ouen", "St John", "Trinity", "Grouville", "St Martin",
]);

const DISTRICT_ALIASES: Record<string, string> = {
  "st. helier north": "St Helier North", "st. helier central": "St Helier Central",
  "st. helier south": "St Helier South", "st. saviour": "St Saviour",
  "st. brelade": "St Brelade", "st. clement": "St Clement",
  "st. peter": "St Peter", "st. lawrence": "St Lawrence",
  "st. mary": "St Mary", "st. ouen": "St Ouen",
  "st. john": "St John", "st. martin": "St Martin",
  "saint helier": "St Helier Central",
};

function normaliseDistrict(raw: string): string | null {
  const trimmed = raw.trim();
  if (VALID_DISTRICTS.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
    if (lower === alias || lower.includes(alias)) return canonical;
  }
  for (const d of VALID_DISTRICTS) {
    if (lower.includes(d.toLowerCase())) return d;
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Fuzzy name match: handles "John Smith" vs "John P. Smith",
 * middle initials, and minor whitespace/case differences.
 */
function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

  const na = norm(a);
  const nb = norm(b);

  // Exact
  if (na === nb) return true;

  // Token containment: all tokens of the shorter name appear in the longer
  const ta = na.split(" ");
  const tb = nb.split(" ");
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (shorter.every((t) => longer.includes(t))) return true;

  // First + last name match (ignore middle names/initials)
  if (
    ta.length >= 2 &&
    tb.length >= 2 &&
    ta[0] === tb[0] &&
    ta[ta.length - 1] === tb[tb.length - 1]
  ) {
    return true;
  }

  return false;
}

// ── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse vote.je markdown into a RawCandidate.
 * Independent parser — vote.je has different page structure than flow.je.
 */
function parseVoteJeMarkdown(
  markdown: string,
  sourceUrl: string,
): RawCandidate | null {
  const lines = markdown.split("\n").map((l) => l.trim());

  // ── Name: first heading that looks like a person name
  let name: string | null = null;
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)/);
    if (m) {
      const candidate = m[1]!.trim()
        .replace(/\*\*/g, "") // strip bold markdown
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // strip links

      if (
        /^[A-Za-zÀ-ÿ\s'\-\.]{3,60}$/.test(candidate) &&
        candidate.split(/\s+/).length >= 2 &&
        candidate.split(/\s+/).length <= 6
      ) {
        name = candidate.replace(/\s+/g, " ").trim();
        break;
      }
    }
  }

  if (!name) return null;

  // ── District
  let district: string | null = null;

  // vote.je patterns: "Candidate for St Brelade", "Standing in Trinity",
  // or structured like "District: St Helier North"
  for (const line of lines) {
    const m = line.match(
      /(?:candidate\s+for|standing\s+(?:in|for)|district|constituency|parish|electoral\s+district)[:\s]+(.+)/i,
    );
    if (m) {
      district = normaliseDistrict(m[1]!.replace(/[*_\[\]()]/g, ""));
      if (district) break;
    }
  }

  // Fallback: scan for any valid district name
  if (!district) {
    for (const line of lines.slice(0, 40)) {
      for (const d of VALID_DISTRICTS) {
        if (line.includes(d)) { district = d; break; }
      }
      if (district) break;
    }
  }

  if (!district) district = "Unknown";

  // ── Party
  let party: string | null = null;
  const partyPatterns = [
    /(?:party|political\s+party|affiliation)[:\s]+(.+)/i,
    /\b(Reform Jersey|Jersey Alliance|Progress Party|Jersey Liberal Conservatives)\b/i,
  ];
  for (const line of lines.slice(0, 30)) {
    for (const pat of partyPatterns) {
      const m = line.match(pat);
      if (m) {
        const raw = m[1]!.replace(/[*_\[\]()]/g, "").trim();
        party = /^independent$/i.test(raw) ? null : raw;
        break;
      }
    }
    if (party !== undefined) break;
  }

  // ── Bio
  let bio: string | null = null;
  const bioLines: string[] = [];
  let pastName = false;
  for (const line of lines) {
    if (!pastName) {
      if (line.includes(name) || /^#{1,3}\s/.test(line)) { pastName = true; continue; }
      continue;
    }
    if (/^#{1,2}\s/.test(line) && bioLines.length > 0) break;
    if (line && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("---")) {
      bioLines.push(line.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
    }
    if (bioLines.length >= 8) break;
  }
  if (bioLines.length > 0) {
    bio = bioLines.join("\n").trim();
    if (bio.length < 20) bio = null;
  }

  // ── Manifesto
  let manifesto_raw: string | null = null;
  const manifestoIdx = lines.findIndex((l) =>
    /^#{1,3}\s.*(manifesto|policies|priorities|pledges|platform|key\s+commit|what\s+i\s+stand)/i.test(l),
  );
  if (manifestoIdx !== -1) {
    const mLines: string[] = [];
    for (let i = manifestoIdx + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (/^#{1,2}\s/.test(line) && mLines.length > 3) break;
      if (line) mLines.push(line);
    }
    if (mLines.length > 0) {
      manifesto_raw = mLines.join("\n").trim();
      if (manifesto_raw.length < 50) manifesto_raw = null;
    }
  }

  // ── Photo
  let photo_url: string | null = null;
  for (const line of lines.slice(0, 25)) {
    const m = line.match(/!\[.*?\]\((.+?)\)/);
    if (m) {
      const url = m[1]!.trim();
      photo_url = url.startsWith("http") ? url : `https://www.vote.je${url.startsWith("/") ? "" : "/"}${url}`;
      break;
    }
  }

  return {
    name, district, party, bio, manifesto_raw,
    manifesto_url: manifesto_raw ? sourceUrl : null,
    photo_url, source_urls: [sourceUrl],
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  // 1. Map
  console.log(`[vote.je] Mapping ${BASE_URL}…`);
  const mapResult = await firecrawl.mapUrl(BASE_URL);

  if (!mapResult.success || !mapResult.links || mapResult.links.length === 0) {
    throw new Error(`Firecrawl map returned 0 results: ${JSON.stringify(mapResult)}`);
  }

  const candidateUrls = [
    ...new Set(
      mapResult.links.filter(
        (url: string) =>
          (url.includes("/candidate") ||
            url.includes("/profile") ||
            url.includes("/election") ||
            url.includes("/person")) &&
          !url.endsWith("/") &&
          !url.includes("#") &&
          !url.includes("?page="),
      ),
    ),
  ];

  console.log(
    `[vote.je] Mapped ${mapResult.links.length} URLs, filtered to ${candidateUrls.length} candidate profiles`,
  );

  if (candidateUrls.length === 0) {
    throw new Error("No candidate URLs found after filtering.");
  }

  // 2. Batch scrape
  console.log(`[vote.je] Batch scraping ${candidateUrls.length} pages…`);
  const scrapeStart = Date.now();
  const scrapeResult = await firecrawl.batchScrapeUrls(candidateUrls, {
    formats: ["markdown"],
  });

  if (!scrapeResult.success) {
    throw new Error(`Batch scrape failed: ${JSON.stringify(scrapeResult)}`);
  }

  const scrapeElapsed = ((Date.now() - scrapeStart) / 1000).toFixed(0);
  console.log(`[vote.je] Scraped ${scrapeResult.data?.length ?? 0} pages (${scrapeElapsed}s)\n`);

  // 3. Parse
  const parsed: RawCandidate[] = [];
  let parseFailures = 0;

  for (const page of scrapeResult.data ?? []) {
    const md = page.markdown;
    const sourceUrl = page.metadata?.sourceURL || page.metadata?.url || "";

    if (!md || md.trim().length < 50) {
      console.warn(`  ⚠ Empty content from ${sourceUrl}`);
      parseFailures++;
      continue;
    }

    const candidate = parseVoteJeMarkdown(md, sourceUrl);

    if (!candidate) {
      console.warn(`  ⚠ Could not extract name from ${sourceUrl}`);
      parseFailures++;
      continue;
    }

    if (candidate.district === "Unknown") {
      console.warn(`  ⚠ Unknown district for "${candidate.name}" — skipping`);
      parseFailures++;
      continue;
    }

    parsed.push(candidate);
  }

  console.log(`[vote.je] Parsed ${parsed.length} candidates, ${parseFailures} failures\n`);

  if (parsed.length < MIN_EXPECTED_CANDIDATES) {
    console.warn(`  ⚠ Only ${parsed.length} candidates — expected ≥${MIN_EXPECTED_CANDIDATES}`);
  }

  // 4. Load all existing candidates for cross-referencing
  const existingAll = await db.select().from(candidates);
  const existingBySlug = new Map(existingAll.map((c) => [c.slug, c]));
  const existingByName = existingAll; // for fuzzy matching

  let newCount = 0;
  let mergedCount = 0;
  let unchangedCount = 0;

  for (const raw of parsed) {
    const slug = slugify(raw.name);

    // Try match by slug first, then by fuzzy name
    let existing = existingBySlug.get(slug) ?? null;

    if (!existing) {
      const match = existingByName.find((c) => namesMatch(c.name, raw.name));
      if (match) existing = match;
    }

    if (!existing) {
      // ── New candidate ─────────────────────────────────────────────────
      const hash = sha256(
        [raw.name, raw.district, raw.party ?? "", raw.bio ?? "", raw.manifesto_raw ?? ""].join("\n---\n"),
      );

      if (DRY_RUN) {
        console.log(`  [DRY] Would insert NEW: ${raw.name} (${raw.district})`);
      } else {
        await db.insert(candidates).values({
          name: raw.name,
          slug,
          district: raw.district,
          party: raw.party,
          photoUrl: raw.photo_url,
          bio: raw.bio,
          manifestoRaw: raw.manifesto_raw,
          manifestoUrl: raw.manifesto_url,
          sourceUrls: raw.source_urls,
          dataHash: hash,
          lastScrapedAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`  + New: ${raw.name} (${raw.district}) [from vote.je only]`);
      }
      newCount++;
      continue;
    }

    // ── Existing candidate — merge ────────────────────────────────────
    const mergedSourceUrls = [...new Set([...existing.sourceUrls, ...raw.source_urls])];
    const sourceChanged = mergedSourceUrls.length > existing.sourceUrls.length;

    // Manifesto strategy: keep the longer/more detailed one
    let manifestoRaw = existing.manifestoRaw;
    let manifestoUrl = existing.manifestoUrl;
    let manifestoChanged = false;

    if (!existing.manifestoRaw && raw.manifesto_raw) {
      // DB has none, vote.je has one → use it
      manifestoRaw = raw.manifesto_raw;
      manifestoUrl = raw.manifesto_url;
      manifestoChanged = true;
    } else if (
      existing.manifestoRaw &&
      raw.manifesto_raw &&
      raw.manifesto_raw.length > existing.manifestoRaw.length * 1.1 // 10% longer
    ) {
      // vote.je has meaningfully more content → replace
      manifestoRaw = raw.manifesto_raw;
      manifestoUrl = raw.manifesto_url;
      manifestoChanged = true;
    }

    // Bio: same strategy
    let bio = existing.bio;
    if (!existing.bio && raw.bio) {
      bio = raw.bio;
    } else if (
      existing.bio &&
      raw.bio &&
      raw.bio.length > existing.bio.length * 1.1
    ) {
      bio = raw.bio;
    }

    // Photo: fill in if missing
    const photoUrl = existing.photoUrl ?? raw.photo_url;

    const anythingChanged =
      sourceChanged || manifestoChanged || bio !== existing.bio || photoUrl !== existing.photoUrl;

    if (!anythingChanged) {
      if (!DRY_RUN) {
        await db
          .update(candidates)
          .set({ lastScrapedAt: new Date() })
          .where(eq(candidates.id, existing.id));
      }
      unchangedCount++;
      continue;
    }

    // Something changed — snapshot + update
    if (DRY_RUN) {
      const changes: string[] = [];
      if (sourceChanged) changes.push("source_urls");
      if (manifestoChanged) changes.push("manifesto");
      if (bio !== existing.bio) changes.push("bio");
      if (photoUrl !== existing.photoUrl) changes.push("photo");
      console.log(`  [DRY] Would merge: ${raw.name} (${changes.join(", ")})`);
    } else {
      await db.insert(snapshots).values({
        entityType: "candidate",
        entityId: existing.id,
        data: {
          name: existing.name,
          bio: existing.bio,
          manifesto_raw: existing.manifestoRaw,
          source_urls: existing.sourceUrls,
          data_hash: existing.dataHash,
        },
      });

      const newHash = sha256(
        [existing.name, existing.district, existing.party ?? "", bio ?? "", manifestoRaw ?? ""].join("\n---\n"),
      );

      const now = new Date();
      await db
        .update(candidates)
        .set({
          bio,
          photoUrl,
          manifestoRaw,
          manifestoUrl,
          sourceUrls: mergedSourceUrls,
          dataHash: newHash,
          lastScrapedAt: now,
          updatedAt: now,
          // Clear AI enrichment if manifesto changed
          ...(manifestoChanged
            ? { aiSummary: null, aiIssues: null, lastEnrichedAt: null }
            : {}),
        })
        .where(eq(candidates.id, existing.id));

      const changes: string[] = [];
      if (sourceChanged) changes.push("sources");
      if (manifestoChanged) changes.push("manifesto");
      if (bio !== existing.bio) changes.push("bio");
      if (photoUrl !== existing.photoUrl) changes.push("photo");
      console.log(`  ~ Merged: ${raw.name} (${changes.join(", ")})`);
    }
    mergedCount++;
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[vote.je] ══════════════════════════════════════`);
  console.log(`[vote.je] New:        ${newCount}`);
  console.log(`[vote.je] Merged:     ${mergedCount}`);
  console.log(`[vote.je] Unchanged:  ${unchangedCount}`);
  console.log(`[vote.je] Parse fail: ${parseFailures}`);
  console.log(`[vote.je] Total:      ${totalElapsed}s`);
  if (DRY_RUN) console.log(`[vote.je] (DRY RUN — no DB writes)`);

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[vote.je] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
