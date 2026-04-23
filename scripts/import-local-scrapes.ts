import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { config as loadEnv } from "dotenv";
import { articles, candidates } from "../src/db/schema";

loadEnv({ path: ".env.local" });

/**
 * One-time import of Firecrawl JSON exports (markdown + metadata) into Postgres.
 *
 * Reads every *.json file from the given directories (default: ~/Downloads/flow.je
 * and ~/Downloads/JSON data of Vote.js on Windows) and:
 * 1. Upserts each page into `articles` by canonical URL (raw markdown preserved).
 * 2. For flow.je single-candidate profile URLs, upserts `candidates` by slug.
 *
 * Usage:
 *   npx tsx scripts/import-local-scrapes.ts
 *   npx tsx scripts/import-local-scrapes.ts "D:\path\to\flow.je" "D:\path\to\vote-folder"
 *
 * Requires DATABASE_URL in .env.local
 */

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[import] ✗ DATABASE_URL not set (.env.local)");
  process.exit(1);
}

function defaultImportDirs(): string[] {
  const base = process.env.USERPROFILE ?? homedir();
  return [
    join(base, "Downloads", "flow.je"),
    join(base, "Downloads", "JSON data of Vote.js"),
  ];
}

function collectJsonFiles(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    console.warn(`[import] ⚠ Skip (not a directory): ${dir}`);
    return [];
  }
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .map((f) => join(dir, f));
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function buildNameRegex(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

interface ScrapeDoc {
  markdown?: string;
  metadata?: Record<string, unknown>;
}

function pickUrl(meta: Record<string, unknown>): string | null {
  const u = meta.url ?? meta.sourceURL;
  if (typeof u === "string" && u.trim()) return u.trim();
  return null;
}

function pickTitle(meta: Record<string, unknown>, markdown: string): string {
  for (const k of ["title", "ogTitle", "og:title"]) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) {
      const t = v.trim();
      const cut = t.split(/\s*\/\s*/)[0];
      if (cut) return cut.trim();
    }
  }
  const m = markdown.match(/^#\s+([^\n]+)/m);
  if (m?.[1]) return m[1].replace(/\*\*/g, "").trim();
  return "Untitled page";
}

function hostnameSource(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h === "flow.je") return "flow.je";
    if (h === "vote.je") return "vote.je";
    return h || "unknown";
  } catch {
    return "unknown";
  }
}

function parsePublishedAt(
  meta: Record<string, unknown>,
  markdown: string,
): Date | null {
  const keys = [
    "article:published_time",
    "article:publishedTime",
    "publishedTime",
    "datePublished",
    "og:updated_time",
  ];
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) {
      const d = new Date(v.trim());
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const pub = markdown.match(/\*\*Published:\s*([^*]+?)\*\*/i);
  if (pub?.[1]) {
    const d = new Date(pub[1].trim());
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** flow.je candidate profile: /elections/candidates/{slug} (not the index). */
function flowCandidateSlugFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, "") !== "flow.je") return null;
    const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    if (parts.length !== 3) return null;
    if (parts[0] !== "elections" || parts[1] !== "candidates") return null;
    const slug = parts[2];
    if (!slug || slug === "candidates") return null;
    return slug;
  } catch {
    return null;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCandidateFromFlowPage(
  url: string,
  markdown: string,
  meta: Record<string, unknown>,
  slug: string,
): {
  name: string;
  slug: string;
  district: string;
  party: string | null;
  bio: string | null;
  manifestoUrl: string | null;
} | null {
  const titleRaw =
    (typeof meta.ogTitle === "string" && meta.ogTitle) ||
    (typeof meta["og:title"] === "string" && meta["og:title"]) ||
    (typeof meta.title === "string" && meta.title) ||
    "";
  let name = titleRaw.split(/\s*\/\s*/)[0]?.trim() || "";
  if (!name) {
    const hm = markdown.match(/^#\s+([^\n]+)/m);
    name = hm?.[1]?.replace(/\*\*/g, "")?.trim() ?? "";
  }
  if (!name) return null;

  let district = "Jersey";
  const dep = markdown.match(
    /(?:current\s+)?(?:Deputy|Connétable)\s+of\s+\[([^\]]+)\]/i,
  );
  const sen = markdown.match(/(?:current\s+)?Senator\b/i);
  if (dep?.[1]) district = dep[1].trim();
  else if (sen) district = "Senator";

  let party: string | null = null;
  const row = new RegExp(
    `\\*\\*${escapeRegex(name)}\\*\\*\\s*\\|\\s*\\[([^\\]]*)\\]\\(https:\\/\\/flow\\.je\\/elections\\/parties\\/`,
    "i",
  ).exec(markdown);
  if (row?.[1]?.trim()) party = row[1].trim();

  let bio: string | null = null;
  const bioM = markdown.match(
    new RegExp(
      `\\n\\n(${escapeRegex(name)}[^\\n]+(?:\\.[^\\n]+)?)`,
      "i",
    ),
  );
  if (bioM?.[1]) bio = bioM[1].replace(/\s+/g, " ").trim().slice(0, 8000);

  let manifestoUrl: string | null = null;
  const mVote = markdown.match(
    /https:\/\/www\.vote\.je\/candidates\/[^\s)]+/i,
  );
  const mArch = markdown.match(/https:\/\/web\.archive\.org\/[^\s)]+/i);
  manifestoUrl = mVote?.[0] ?? mArch?.[0] ?? null;

  return { name, slug, district, party, bio, manifestoUrl };
}

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { articles, candidates } });

async function main() {
  const dirs =
    process.argv.length > 2
      ? process.argv.slice(2)
      : defaultImportDirs().filter((d) => statSync(d, { throwIfNoEntry: false })?.isDirectory());

  if (dirs.length === 0) {
    console.error(
      "[import] ✗ No import directories. Pass paths as args or create default Download folders.",
    );
    process.exit(1);
  }

  const files = [...new Set(dirs.flatMap(collectJsonFiles))];
  console.log(`[import] ${files.length} JSON file(s) from ${dirs.length} folder(s)\n`);

  const allCandidates = await db
    .select({ id: candidates.id, name: candidates.name })
    .from(candidates);
  const nameMatchers = allCandidates.map((c) => ({
    id: c.id,
    name: c.name,
    regex: buildNameRegex(c.name),
  }));

  let articlesUpserted = 0;
  let articlesSkipped = 0;
  let candidatesUpserted = 0;
  let parseErrors = 0;

  for (const filePath of files) {
    let raw: string;
    try {
      raw = readFileSync(filePath, "utf8");
    } catch {
      console.warn(`[import] ⚠ Unreadable: ${filePath}`);
      articlesSkipped++;
      continue;
    }

    let doc: ScrapeDoc;
    try {
      doc = JSON.parse(raw) as ScrapeDoc;
    } catch {
      console.warn(`[import] ⚠ Invalid JSON: ${basename(filePath)}`);
      parseErrors++;
      continue;
    }

    const meta = doc.metadata;
    if (!meta || typeof meta !== "object") {
      articlesSkipped++;
      continue;
    }

    const url = pickUrl(meta as Record<string, unknown>);
    if (!url) {
      console.warn(`[import] ⚠ No URL in metadata: ${basename(filePath)}`);
      articlesSkipped++;
      continue;
    }

    const markdown = typeof doc.markdown === "string" ? doc.markdown : "";
    const title = pickTitle(meta as Record<string, unknown>, markdown);
    const source = hostnameSource(url);
    const publishedAt = parsePublishedAt(meta as Record<string, unknown>, markdown);
    const contentHash = markdown ? sha256(markdown) : null;

    const mentionedIds: string[] = [];
    for (const matcher of nameMatchers) {
      if (matcher.regex.test(markdown)) mentionedIds.push(matcher.id);
    }
    const uniqueMentions = [...new Set(mentionedIds)];

    try {
      await db
        .insert(articles)
        .values({
          title: title.slice(0, 5000),
          source,
          url,
          publishedAt,
          contentRaw: markdown || null,
          contentHash,
          candidateMentions: uniqueMentions,
          aiSummary: null,
          aiSentiment: null,
        })
        .onConflictDoUpdate({
          target: articles.url,
          set: {
            title: sql`excluded.title`,
            source: sql`excluded.source`,
            publishedAt: sql`excluded.published_at`,
            contentRaw: sql`excluded.content_raw`,
            contentHash: sql`excluded.content_hash`,
            candidateMentions: sql`excluded.candidate_mentions`,
          },
        });
      articlesUpserted++;
    } catch (err) {
      console.warn(
        `[import] ⚠ Article upsert failed ${url}: ${err instanceof Error ? err.message : err}`,
      );
      articlesSkipped++;
    }

    const slug = flowCandidateSlugFromUrl(url);
    if (slug && markdown) {
      const parsed = parseCandidateFromFlowPage(
        url,
        markdown,
        meta as Record<string, unknown>,
        slug,
      );
      if (parsed) {
        const dataHash = parsed.manifestoUrl ? sha256(parsed.manifestoUrl) : null;
        const now = new Date();
        try {
          await db
            .insert(candidates)
            .values({
              name: parsed.name,
              slug: parsed.slug,
              district: parsed.district,
              party: parsed.party,
              photoUrl: null,
              bio: parsed.bio,
              manifestoRaw: null,
              manifestoUrl: parsed.manifestoUrl,
              sourceUrls: [url],
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
                photoUrl: sql`COALESCE(excluded.photo_url, candidates.photo_url)`,
                bio: sql`COALESCE(NULLIF(excluded.bio, ''), candidates.bio)`,
                manifestoRaw: sql`COALESCE(excluded.manifesto_raw, candidates.manifesto_raw)`,
                manifestoUrl: sql`COALESCE(excluded.manifesto_url, candidates.manifesto_url)`,
                sourceUrls: sql`excluded.source_urls`,
                dataHash: sql`COALESCE(excluded.data_hash, candidates.data_hash)`,
                lastScrapedAt: sql`excluded.last_scraped_at`,
                updatedAt: sql`excluded.updated_at`,
              },
            });
          candidatesUpserted++;
        } catch (err) {
          console.warn(
            `[import] ⚠ Candidate upsert failed ${parsed.slug}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }
  }

  const [aCount] = await pgClient<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM articles
  `;
  const [cCount] = await pgClient<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM candidates
  `;

  console.log(`\n[import] ══════════════════════════════════════`);
  console.log(`[import] Article files upserted:  ${articlesUpserted}`);
  console.log(`[import] Skipped / errors:        ${articlesSkipped} (+ ${parseErrors} JSON parse)`);
  console.log(`[import] Candidate rows touched:   ${candidatesUpserted} (flow.je profiles only)`);
  console.log(`[import] Total articles in DB:     ${aCount?.n ?? "?"}`);
  console.log(`[import] Total candidates in DB:   ${cCount?.n ?? "?"}`);
  console.log(`[import] ══════════════════════════════════════`);

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[import] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
