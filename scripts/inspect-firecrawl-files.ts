import * as fs from "node:fs";
import * as path from "node:path";

import "./bootstrap-env";

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

function isCandidateFile(data: unknown): boolean {
  const d = data as { metadata?: { sourceURL?: string }; markdown?: string };
  const url = d?.metadata?.sourceURL || "";
  const markdown = d?.markdown || "";
  return url.includes("/elections/candidates/") && markdown.length > 200;
}

/**
 * Breadcrumb is always on line 1: "# [flow.je]... / [Elections]... / [Candidates]... / Name"
 * The display name is the last "/" segment (after stripping markdown links).
 */
function extractNameFromBreadcrumb(markdown: string): string | null {
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

async function main() {
  if (!fs.existsSync(FLOW_JE_FOLDER)) {
    console.error(`Folder not found: ${FLOW_JE_FOLDER}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(FLOW_JE_FOLDER)
    .filter((f) => f.endsWith(".json") && f.includes("_elections_candidates_"));

  console.log(`\n=== VOTEPULSE FILE INSPECTOR ===`);
  console.log(`Candidate files found: ${files.length}\n`);

  const results: Array<Record<string, unknown>> = [];
  let noName = 0;
  let noDistrict = 0;

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(FLOW_JE_FOLDER, file), "utf-8");
      const data: unknown = JSON.parse(raw) as unknown;

      if (!isCandidateFile(data)) {
        console.warn(`SKIP (not candidate): ${file}`);
        continue;
      }

      const md = (data as { markdown: string }).markdown;
      const sourceUrl = (data as { metadata: { sourceURL: string } }).metadata
        .sourceURL;
      const name = extractNameFromBreadcrumb(md);
      const district =
        JERSEY_DISTRICTS.find((d) => md.includes(d)) || null;
      const party = JERSEY_PARTIES.find((p) => md.includes(p)) || null;
      const hasPhoto = /!\[[^\]]*\]\(https?:\/\/[^)]+\)/.test(md);
      const manifestoLength = md.length;

      if (!name) noName++;
      if (!district) noDistrict++;

      results.push({
        file,
        name: name || "⚠️ COULD NOT EXTRACT",
        district: district || "⚠️ NOT FOUND",
        party: party || "Independent",
        sourceUrl,
        hasPhoto,
        markdownLength: manifestoLength,
      });

      const status = name ? "✓" : "⚠️";
      console.log(
        `${status} ${(name || file).padEnd(30)} | ${(district || "?").padEnd(22)} | ${party || "Independent"}`,
      );
    } catch (e) {
      console.error(`ERROR: ${file}:`, e);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total candidate files: ${results.length}`);
  console.log(`Missing name: ${noName}`);
  console.log(`Missing district: ${noDistrict}`);
  console.log(
    `Have photo: ${results.filter((r) => r.hasPhoto).length}`,
  );
  console.log(`Party breakdown:`);

  const parties: Record<string, number> = {};
  results.forEach((r) => {
    const p = String(r.party);
    parties[p] = (parties[p] || 0) + 1;
  });
  Object.entries(parties)
    .sort(([, a], [, b]) => b - a)
    .forEach(([p, n]) => console.log(`  ${p}: ${n}`));

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(
    "./data/inspect-report.json",
    JSON.stringify(results, null, 2),
  );
  console.log(`\nSaved: data/inspect-report.json`);
  console.log(`\nIf this looks correct → run: npm run import:local`);
}

main().catch(console.error);
