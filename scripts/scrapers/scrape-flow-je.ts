import Firecrawl from "@mendable/firecrawl-js";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { candidates, snapshots } from "../../src/db/schema";

/**
 * VotePulse — flow.je Candidate Scraper
 *
 * Uses Firecrawl to map + batch-scrape candidate profiles from flow.je,
 * then diffs against existing DB records and upserts changes.
 *
 * Usage:
 *   npx tsx scripts/scrapers/scrape-flow-je.ts
 *   npx tsx scripts/scrapers/scrape-flow-je.ts --dry-run
 *
 * Requires:
 *   FIRECRAWL_API_KEY in env (or .env.local)
 *   DATABASE_URL in env (or .env.local)
 */

// ── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = "https://flow.je/elections/2026";
const MIN_EXPECTED_CANDIDATES = 10;

// ── Bootstrap ───────────────────────────────────────────────────────────────

const { config } = await import("dotenv");
config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!DATABASE_URL) {
  console.error("[scrape] ✗ DATABASE_URL not set");
  process.exit(1);
}
if (!FIRECRAWL_API_KEY) {
  console.error("[scrape] ✗ FIRECRAWL_API_KEY not set");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
if (DRY_RUN) console.log("[scrape] ── DRY RUN MODE ──\n");

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
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

// ── Valid districts ─────────────────────────────────────────────────────────

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

// Normalise district names — flow.je may use slight variations
const DISTRICT_ALIASES: Record<string, string> = {
  "st. helier north": "St Helier North",
  "st. helier central": "St Helier Central",
  "st. helier south": "St Helier South",
  "st. saviour": "St Saviour",
  "st. brelade": "St Brelade",
  "st. clement": "St Clement",
  "st. peter": "St Peter",
  "st. lawrence": "St Lawrence",
  "st. mary": "St Mary",
  "st. ouen": "St Ouen",
  "st. john": "St John",
  "st. martin": "St Martin",
  "st helier": "St Helier Central", // ambiguous fallback
};

function normaliseDistrict(raw: string): string | null {
  const trimmed = raw.trim();
  if (VALID_DISTRICTS.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
    if (lower === alias || lower.includes(alias)) return canonical;
  }
  // Try matching any valid district as substring
  for (const d of VALID_DISTRICTS) {
    if (lower.includes(d.toLowerCase())) return d;
  }
  return null;
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

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse a Firecrawl markdown output into a RawCandidate.
 *
 * This is DETERMINISTIC — no AI. Uses structural patterns from flow.je's
 * candidate profile pages. Returns null if the name can't be confidently
 * extracted (better to skip than insert garbage).
 */
function parseCandidateMarkdown(
  markdown: string,
  sourceUrl: string,
): RawCandidate | null {
  const lines = markdown.split("\n").map((l) => l.trim());

  // ── Name: first H1 or H2 that looks like a person's name
  let name: string | null = null;
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,2}\s+(.+)/);
    if (headingMatch) {
      const candidate = headingMatch[1]!.trim();
      // A person's name is 2-5 words, no special chars except hyphens/apostrophes
      if (
        /^[A-Za-zÀ-ÿ\s'\-]{3,60}$/.test(candidate) &&
        candidate.split(/\s+/).length >= 2 &&
        candidate.split(/\s+/).length <= 5
      ) {
        name = candidate;
        break;
      }
    }
  }

  if (!name) return null;

  // ── District: look for known district patterns
  let district: string | null = null;
  for (const line of lines) {
    // Common patterns: "District: St Helier North", "Standing in St Brelade"
    const distMatch = line.match(
      /(?:district|standing\s+in|constituency|parish)[:\s]*(.+)/i,
    );
    if (distMatch) {
      district = normaliseDistrict(distMatch[1]!);
      if (district) break;
    }
    // Also check if any valid district name appears in the line near the top
    if (!district) {
      for (const d of VALID_DISTRICTS) {
        if (line.includes(d)) {
          district = d;
          break;
        }
      }
    }
    if (district) break;
  }

  // Also try scanning the full text for district
  if (!district) {
    for (const d of VALID_DISTRICTS) {
      if (markdown.includes(d)) {
        district = d;
        break;
      }
    }
  }

  if (!district) {
    // Can't determine district — still return with empty, let validation handle it
    district = "Unknown";
  }

  // ── Party
  let party: string | null = null;
  const partyPatterns = [
    /(?:party|affiliation)[:\s]*(.+)/i,
    /\b(Reform Jersey|Jersey Alliance|Progress Party|Jersey Liberal Conservatives)\b/i,
    /\b(Independent)\b/i,
  ];
  for (const line of lines) {
    for (const pattern of partyPatterns) {
      const m = line.match(pattern);
      if (m) {
        const raw = m[1]!.trim();
        party =
          raw.toLowerCase() === "independent" ? null : raw;
        break;
      }
    }
    if (party !== null || (party === null && lines.indexOf(line) > 20)) break;
  }

  // ── Bio: paragraph(s) before the manifesto section
  let bio: string | null = null;
  const bioLines: string[] = [];
  let inBio = false;
  for (const line of lines) {
    if (line === name || line === `# ${name}` || line === `## ${name}`) {
      inBio = true;
      continue;
    }
    if (inBio) {
      if (
        /^#{1,3}\s/.test(line) &&
        (line.toLowerCase().includes("manifesto") ||
          line.toLowerCase().includes("policy") ||
          line.toLowerCase().includes("priorities") ||
          line.toLowerCase().includes("platform"))
      ) {
        break;
      }
      if (line && !line.startsWith("#")) {
        bioLines.push(line);
      }
    }
    if (bioLines.length >= 10) break; // Cap bio extraction
  }
  if (bioLines.length > 0) {
    bio = bioLines.join("\n").trim();
    if (bio.length < 20) bio = null; // Too short to be meaningful
  }

  // ── Manifesto: everything after a manifesto/policy heading
  let manifesto_raw: string | null = null;
  const manifestoStart = lines.findIndex((l) =>
    /^#{1,3}\s.*(manifesto|policy|priorities|platform|pledges|key\s+commit)/i.test(
      l,
    ),
  );
  if (manifestoStart !== -1) {
    const manifestoLines: string[] = [];
    for (let i = manifestoStart + 1; i < lines.length; i++) {
      const line = lines[i]!;
      // Stop at footer patterns
      if (
        /^#{1,2}\s/.test(line) &&
        !/^#{3}\s/.test(line) &&
        !line.toLowerCase().includes("policy") &&
        !line.toLowerCase().includes("promise")
      ) {
        break;
      }
      if (line) manifestoLines.push(line);
    }
    if (manifestoLines.length > 0) {
      manifesto_raw = manifestoLines.join("\n").trim();
      if (manifesto_raw.length < 50) manifesto_raw = null;
    }
  }

  // If no structured manifesto section, use the full body as manifesto
  if (!manifesto_raw) {
    const bodyLines = lines.filter(
      (l) => l && !l.startsWith("#") && l.length > 20,
    );
    if (bodyLines.length >= 3) {
      manifesto_raw = bodyLines.join("\n").trim();
    }
  }

  // ── Photo URL: look for image markdown
  let photo_url: string | null = null;
  for (const line of lines.slice(0, 30)) {
    const imgMatch = line.match(/!\[.*?\]\((.+?)\)/);
    if (imgMatch) {
      const url = imgMatch[1]!.trim();
      if (
        url.includes("photo") ||
        url.includes("portrait") ||
        url.includes("candidate") ||
        url.includes("headshot") ||
        url.endsWith(".jpg") ||
        url.endsWith(".png") ||
        url.endsWith(".webp")
      ) {
        photo_url = url.startsWith("http")
          ? url
          : `https://flow.je${url.startsWith("/") ? "" : "/"}${url}`;
        break;
      }
    }
  }
  // Fallback: first image
  if (!photo_url) {
    for (const line of lines.slice(0, 30)) {
      const imgMatch = line.match(/!\[.*?\]\((.+?)\)/);
      if (imgMatch) {
        const url = imgMatch[1]!.trim();
        photo_url = url.startsWith("http")
          ? url
          : `https://flow.je${url.startsWith("/") ? "" : "/"}${url}`;
        break;
      }
    }
  }

  return {
    name,
    district,
    party,
    bio,
    manifesto_raw,
    manifesto_url: manifesto_raw ? sourceUrl : null,
    photo_url,
    source_urls: [sourceUrl],
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  // ── 1. Map URLs ───────────────────────────────────────────────────────────
  console.log(`[scrape] Mapping ${BASE_URL}…`);
  const mapResult = await firecrawl.mapUrl(BASE_URL);

  if (
    !mapResult.success ||
    !mapResult.links ||
    mapResult.links.length === 0
  ) {
    throw new Error(
      `Firecrawl map returned 0 results — site may be down or URL changed. Response: ${JSON.stringify(mapResult)}`,
    );
  }

  // Filter for candidate profile URLs
  const candidateUrls = [
    ...new Set(
      mapResult.links.filter(
        (url: string) =>
          (url.includes("/candidates/") ||
            url.includes("/elections/2026/")) &&
          !url.endsWith("/elections/2026") &&
          !url.endsWith("/elections/2026/") &&
          !url.includes("#") &&
          !url.includes("?"),
      ),
    ),
  ];

  console.log(
    `[scrape] Mapped ${mapResult.links.length} URLs, filtered to ${candidateUrls.length} candidate profiles`,
  );

  if (candidateUrls.length === 0) {
    throw new Error(
      "No candidate URLs found after filtering. Check URL patterns.",
    );
  }

  // ── 2. Batch scrape ───────────────────────────────────────────────────────
  console.log(`[scrape] Batch scraping ${candidateUrls.length} pages…`);
  const scrapeStart = Date.now();

  const scrapeResult = await firecrawl.batchScrapeUrls(candidateUrls, {
    formats: ["markdown"],
  });

  if (!scrapeResult.success) {
    throw new Error(
      `Firecrawl batch scrape failed: ${JSON.stringify(scrapeResult)}`,
    );
  }

  const scrapeElapsed = ((Date.now() - scrapeStart) / 1000).toFixed(0);
  console.log(
    `[scrape] Scraped ${scrapeResult.data?.length ?? 0} pages (${scrapeElapsed}s)\n`,
  );

  // ── 3. Parse ──────────────────────────────────────────────────────────────
  const parsed: RawCandidate[] = [];
  let parseFailures = 0;

  for (const page of scrapeResult.data ?? []) {
    const md = page.markdown;
    const sourceUrl = page.metadata?.sourceURL || page.metadata?.url || "";

    if (!md || md.trim().length < 50) {
      console.warn(
        `  ⚠ Empty/short content from ${sourceUrl} — skipping`,
      );
      parseFailures++;
      continue;
    }

    const candidate = parseCandidateMarkdown(md, sourceUrl);

    if (!candidate) {
      console.warn(`  ⚠ Could not extract name from ${sourceUrl} — skipping`);
      parseFailures++;
      continue;
    }

    if (candidate.district === "Unknown") {
      console.warn(
        `  ⚠ Could not determine district for "${candidate.name}" — skipping`,
      );
      parseFailures++;
      continue;
    }

    parsed.push(candidate);
  }

  console.log(
    `[scrape] Parsed ${parsed.length} candidates, ${parseFailures} parse failures\n`,
  );

  if (parsed.length < MIN_EXPECTED_CANDIDATES) {
    console.warn(
      `  ⚠ WARNING: Only ${parsed.length} candidates parsed. Jersey typically has 50-80. Check parser or source.`,
    );
  }

  // ── 4. Diff and update ────────────────────────────────────────────────────
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const raw of parsed) {
    const slug = slugify(raw.name);
    const contentForHash = [
      raw.name,
      raw.district,
      raw.party ?? "",
      raw.bio ?? "",
      raw.manifesto_raw ?? "",
    ].join("\n---\n");
    const newHash = sha256(contentForHash);

    // Check existing
    const [existing] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.slug, slug))
      .limit(1);

    if (!existing) {
      // New candidate
      if (DRY_RUN) {
        console.log(`  [DRY] Would insert: ${raw.name} (${raw.district})`);
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
          dataHash: newHash,
          lastScrapedAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`  + New: ${raw.name} (${raw.district})`);
      }
      newCount++;
      continue;
    }

    // Existing — check for changes
    if (existing.dataHash === newHash) {
      // Update lastScrapedAt even if content unchanged
      if (!DRY_RUN) {
        await db
          .update(candidates)
          .set({ lastScrapedAt: new Date() })
          .where(eq(candidates.id, existing.id));
      }
      unchangedCount++;
      continue;
    }

    // Content changed — snapshot old state first
    if (DRY_RUN) {
      console.log(`  [DRY] Would update: ${raw.name} (content changed)`);
    } else {
      // Snapshot
      await db.insert(snapshots).values({
        entityType: "candidate",
        entityId: existing.id,
        data: {
          name: existing.name,
          district: existing.district,
          party: existing.party,
          bio: existing.bio,
          manifesto_raw: existing.manifestoRaw,
          data_hash: existing.dataHash,
        },
      });

      // Merge source_urls (don't lose existing ones)
      const mergedSourceUrls = [
        ...new Set([...existing.sourceUrls, ...raw.source_urls]),
      ];

      const now = new Date();
      await db
        .update(candidates)
        .set({
          name: raw.name,
          district: raw.district,
          party: raw.party,
          photoUrl: raw.photo_url ?? existing.photoUrl,
          bio: raw.bio ?? existing.bio,
          // Only overwrite manifesto if new one exists — NEVER delete
          manifestoRaw: raw.manifesto_raw ?? existing.manifestoRaw,
          manifestoUrl: raw.manifesto_url ?? existing.manifestoUrl,
          sourceUrls: mergedSourceUrls,
          dataHash: newHash,
          lastScrapedAt: now,
          updatedAt: now,
          // Clear AI enrichment so pipeline re-processes
          aiSummary: null,
          aiIssues: null,
          lastEnrichedAt: null,
        })
        .where(eq(candidates.id, existing.id));

      console.log(`  ~ Updated: ${raw.name} (content changed)`);
    }
    updatedCount++;
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[scrape] ══════════════════════════════════════`);
  console.log(`[scrape] New:        ${newCount}`);
  console.log(`[scrape] Updated:    ${updatedCount}`);
  console.log(`[scrape] Unchanged:  ${unchangedCount}`);
  console.log(`[scrape] Parse fail: ${parseFailures}`);
  console.log(`[scrape] Total:      ${totalElapsed}s`);
  if (DRY_RUN) console.log(`[scrape] (DRY RUN — no DB writes)`);

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[scrape] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
