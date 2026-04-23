import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import "./bootstrap-env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { candidates } from "../src/db/schema";

const FLOW_JE_FOLDER = "./data/flow.je";

const JERSEY_DISTRICTS = [
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
];

const JERSEY_PARTIES = [
  "Reform Jersey",
  "Jersey Alliance",
  "Progress Party",
  "Liberal Conservatives",
  "Jersey Democrats",
];

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[import:local] ✗ DATABASE_URL not set (.env.local)");
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 2,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { candidates } });

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/** Line 1 breadcrumb: last "/" segment = candidate name. */
function extractName(markdown: string): string | null {
  const first = markdown.split("\n", 1)[0] ?? "";
  if (!first.startsWith("# ")) return null;
  const rest = first.replace(/^#\s+/, "");
  const segments = rest.split("/").map((s) =>
    s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim(),
  );
  const last = segments[segments.length - 1] ?? "";
  const name = last.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 100) return null;
  if (/^menu$/i.test(name)) return null;
  return name;
}

function extractBio(markdown: string, _name: string): string | null {
  const lines = markdown.split("\n");
  const bioLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("- [") || line === "Menu")
      continue;
    if (line.trim().length > 80) {
      bioLines.push(line.trim());
      if (bioLines.length >= 3) break;
    }
  }

  const bio = bioLines.join(" ").trim();
  return bio.length > 50 ? bio.substring(0, 500) : null;
}

function cleanMarkdown(markdown: string): string {
  const lines = markdown.split("\n");
  const cleaned: string[] = [];
  let pastNav = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";

    if (!pastNav) {
      if (line.startsWith("#") && line.includes("flow.je")) continue;
      if (line.startsWith("- [") || line.startsWith("* [")) continue;
      if (line === "Menu") continue;
      if (line === "") continue;
      pastNav = true;
    }

    cleaned.push(lines[i]!);
  }

  return cleaned.join("\n").trim();
}

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function extractManifesto(markdown: string): string {
  const noNav = cleanMarkdown(markdown);
  const noLinks = stripMarkdownLinks(noNav);
  const sectionPattern =
    /(?:#{1,3}\s*(?:Manifesto|Pledges|My Priorities|Key Promises|Policies|Commitments|What I Stand For|My Plans|Election Pledges)[^\n]*\n)([\s\S]+?)(?=\n#{1,3}\s|\Z)/i;
  const section = noLinks.match(sectionPattern);
  if (section?.[1] && section[1].trim().length > 100) {
    return section[1].trim();
  }

  return noLinks.trim();
}

function extractPhotoUrl(markdown: string, metadata: Record<string, string>) {
  const imgMatch = markdown.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/);
  if (imgMatch) return imgMatch[1]!;
  return (metadata.ogImage as string | undefined) || (metadata["og:image"] as string | undefined) || null;
}

function isCandidateFile(data: {
  metadata?: { sourceURL?: string };
  markdown?: string;
}): boolean {
  const url = data?.metadata?.sourceURL || "";
  const markdown = data?.markdown || "";
  return url.includes("/elections/candidates/") && markdown.length > 200;
}

async function main() {
  const files = fs
    .readdirSync(FLOW_JE_FOLDER)
    .filter((f) => f.endsWith(".json") && f.includes("_elections_candidates_"));

  console.log(`\n=== VOTEPULSE IMPORT ===`);
  console.log(`Processing ${files.length} candidate files\n`);

  const stats = {
    parsed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  const candidateMap = new Map<string, {
    name: string;
    slug: string;
    district: string;
    party: string | null;
    bio: string | null;
    photo_url: string | null;
    manifesto_raw: string;
    manifesto_url: string;
    source_urls: string[];
    data_hash: string;
  }>();

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(FLOW_JE_FOLDER, file), "utf-8");
      const data = JSON.parse(raw) as {
        markdown: string;
        metadata: Record<string, string>;
      };

      if (!isCandidateFile(data)) {
        stats.skipped++;
        continue;
      }

      const markdown = data.markdown;
      const metadata = data.metadata || {};
      const sourceUrl = metadata.sourceURL!;

      const name = extractName(markdown);
      if (!name) {
        console.warn(`  ⚠️  Cannot extract name: ${file}`);
        stats.skipped++;
        continue;
      }

      const slug = toSlug(name);
      const district =
        JERSEY_DISTRICTS.find((d) => markdown.includes(d)) || "Unknown";
      const party = JERSEY_PARTIES.find((p) => markdown.includes(p)) || null;
      const bio = extractBio(markdown, name);
      const manifesto_raw = extractManifesto(markdown);
      const photo_url = extractPhotoUrl(markdown, metadata);

      const candidate = {
        name,
        slug,
        district,
        party,
        bio,
        photo_url,
        manifesto_raw,
        manifesto_url: sourceUrl,
        source_urls: [sourceUrl],
        data_hash: sha256(manifesto_raw),
      };

      const existing = candidateMap.get(slug);
      if (existing) {
        const merged = {
          ...existing,
          source_urls: [...new Set([...existing.source_urls, sourceUrl])],
          bio: existing.bio || bio,
          photo_url: existing.photo_url || photo_url,
          manifesto_raw:
            manifesto_raw.length > (existing.manifesto_raw?.length || 0)
              ? manifesto_raw
              : existing.manifesto_raw,
        };
        merged.data_hash = sha256(merged.manifesto_raw);
        candidateMap.set(slug, merged);
      } else {
        candidateMap.set(slug, candidate);
      }

      stats.parsed++;
    } catch (e) {
      console.error(`  ❌  ${file}:`, e);
      stats.errors++;
    }
  }

  console.log(
    `Parsed: ${stats.parsed} candidate rows (${candidateMap.size} unique slugs)\n`,
  );

  for (const [, c] of candidateMap) {
    try {
      const existing = await db
        .select({
          id: candidates.id,
          sourceUrls: candidates.sourceUrls,
          manifestoRaw: candidates.manifestoRaw,
          manifestoUrl: candidates.manifestoUrl,
          bio: candidates.bio,
          photoUrl: candidates.photoUrl,
          party: candidates.party,
        })
        .from(candidates)
        .where(eq(candidates.slug, c.slug))
        .limit(1);

      if (existing.length > 0) {
        const ex = existing[0]!;

        await db
          .update(candidates)
          .set({
            sourceUrls: [
              ...new Set([...(ex.sourceUrls || []), ...c.source_urls]),
            ],
            bio: ex.bio || c.bio,
            photoUrl: ex.photoUrl || c.photo_url,
            party: ex.party || c.party,
            manifestoRaw: c.manifesto_raw,
            manifestoUrl: c.manifesto_url,
            dataHash: c.data_hash,
            aiSummary: null,
            aiIssues: null,
            lastEnrichedAt: null,
            lastScrapedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(candidates.slug, c.slug));

        console.log(`  ↺  Updated : ${c.name}`);
        stats.updated++;
      } else {
        await db.insert(candidates).values({
          name: c.name,
          slug: c.slug,
          district: c.district,
          party: c.party,
          bio: c.bio,
          photoUrl: c.photo_url,
          manifestoRaw: c.manifesto_raw,
          manifestoUrl: c.manifesto_url,
          sourceUrls: c.source_urls,
          dataHash: c.data_hash,
          lastScrapedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(
          `  ✓  Inserted: ${c.name.padEnd(28)} | ${c.district}`,
        );
        stats.inserted++;
      }
    } catch (e) {
      console.error(`  ❌  ${c.name}:`, e);
      stats.errors++;
    }
  }

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`  Parsed  : ${stats.parsed}`);
  console.log(`  Inserted: ${stats.inserted}`);
  console.log(`  Updated : ${stats.updated}`);
  console.log(`  Skipped : ${stats.skipped}`);
  console.log(`  Errors  : ${stats.errors}`);
  console.log(`\nNext: npm run enrich:batch`);

  await pgClient.end({ timeout: 5 });
}

main().catch(async (e) => {
  console.error(e);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
