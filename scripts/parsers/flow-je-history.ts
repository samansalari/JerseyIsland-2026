/**
 * Pure parsers for flow.je candidate-page markdown.
 *
 * Kept side-effect-free (no DB, no env access) so the importer and any
 * smoke tests can share the same logic. All inputs are strings; outputs
 * are plain JSON-serialisable structures matching the `ElectionHistory`
 * jsonb shape declared in `src/db/schema.ts`.
 */

import type {
  ElectionHistory,
  ElectionRecord,
  ElectionResult,
} from "../../src/db/schema";

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

/** Strip markdown formatting from a name cell (`**[X](url)**`, `~~[X](url)~~`, etc). */
function stripNameMarkdown(s: string): string {
  return s
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

/** Strip top-level markdown links from a string while keeping inner text. */
function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/** Loose name match — case-insensitive and ignores extra whitespace. */
function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

/** Parse an integer that may have commas (e.g. "2,317"). */
function parseIntComma(s: string): number | null {
  const cleaned = s.replace(/,/g, "").trim();
  if (!/^\d+$/.test(cleaned)) return null;
  return parseInt(cleaned, 10);
}

/** Parse a markdown results table inside an election block. */
function parseResultsTable(
  block: string,
  candidateName: string,
): ElectionResult[] {
  const rows: ElectionResult[] = [];
  const lines = block.split("\n");
  let pastSeparator = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("|")) {
      if (pastSeparator) break;
      continue;
    }

    if (/^\|[\s|:-]+\|$/.test(trimmed)) {
      pastSeparator = true;
      continue;
    }

    if (!pastSeparator) continue; // header row

    const cells = trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

    if (cells.length < 4) continue;

    const rank = parseInt(cells[0] ?? "", 10);
    if (!Number.isFinite(rank) || rank <= 0) continue;

    const name = stripNameMarkdown(cells[1] ?? "");
    if (!name || name.toUpperCase() === "NAME") continue;

    const party = stripNameMarkdown(cells[2] ?? "") || null;

    const votesCell = (cells[3] ?? "").trim();
    const votes = parseIntComma(votesCell);

    const pctCell = (cells[4] ?? "").trim();
    const percentage = /\d/.test(pctCell) ? pctCell : null;

    rows.push({
      rank,
      name,
      party,
      votes,
      percentage,
      isCandidate: namesMatch(name, candidateName),
    });
  }

  return rows;
}

/** Extract URLs from the `#### Sources` subsection of a single election block. */
function extractBlockSources(block: string): string[] {
  const sourcesIdx = block.search(/#{2,4}\s*Sources/i);
  if (sourcesIdx === -1) return [];

  const tail = block.substring(sourcesIdx);
  const urls: string[] = [];
  const seen = new Set<string>();
  const re = /https?:\/\/[^\s)\]>]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tail)) !== null) {
    const url = m[0].replace(/[)\].,]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/** Parse the `## Election History` section into structured records. */
export function extractElectionHistory(
  markdown: string,
  candidateName: string,
): ElectionHistory {
  const historyMatch = markdown.match(/^##\s+Election History\s*\n([\s\S]*)$/im);
  if (!historyMatch) return [];

  const historyBody = historyMatch[1] ?? "";

  const blocks = historyBody
    .split(/\n(?=###\s)/)
    .map((b) => b.trim())
    .filter((b) => b.startsWith("### "));

  const records: ElectionRecord[] = [];

  for (const blockRaw of blocks) {
    // Trim everything from the next top-level "##" onward (footer / unrelated).
    const block = blockRaw.split(/\n##\s/)[0] ?? blockRaw;

    const firstLine = block.split("\n", 1)[0] ?? "";
    const electionName = firstLine.replace(/^#+\s*/, "").trim();
    if (!electionName || electionName.length < 5) continue;

    const yearMatch = electionName.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : 0;

    // Role: "Election for the role of <ROLE> (N seat)". The role text often
    // contains a markdown link like `Deputy of [St Brelade No 1](url)`, so we
    // strip markdown FIRST and then run the regex against clean prose.
    const blockClean = stripMarkdownLinks(block);
    const roleMatch = blockClean.match(
      /role of\s+(.+?)\s*\(\d+\s+seats?\)/i,
    );
    let role = roleMatch ? roleMatch[1].trim() : "";
    if (!role) role = electionName;
    role = stripNameMarkdown(role);

    const dateMatch = block.match(
      /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    );
    const date = dateMatch ? dateMatch[1] : null;

    const seatsMatch = block.match(/\((\d+)\s+seats?\)/i);
    const seats = seatsMatch ? parseInt(seatsMatch[1], 10) : null;

    const escapedName = candidateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const resultRegex = new RegExp(
      `${escapedName}\\s+(was elected|was not elected|withdrew)`,
      "i",
    );
    const resultMatch = block.match(resultRegex);
    let result: ElectionRecord["result"] = "unknown";
    if (resultMatch) {
      const verdict = resultMatch[1].toLowerCase();
      if (verdict.includes("not elected")) result = "not_elected";
      else if (verdict.includes("elected")) result = "elected";
      else if (verdict.includes("withdrew")) result = "withdrew";
    }

    const allResults = parseResultsTable(block, candidateName);
    const candidateRow = allResults.find((r) => r.isCandidate) ?? null;

    if (result === "unknown" && candidateRow) {
      if (candidateRow.votes === null && /withdrew/i.test(block)) {
        result = "withdrew";
      } else if (seats === 1 && candidateRow.rank === 1) {
        result = "elected";
      } else if (seats !== null && candidateRow.rank > seats) {
        result = "not_elected";
      }
    }

    // Some election blocks use "votes" (older single-vote elections) and
    // others use "ballots" (multi-seat districts where a voter casts up to N
    // votes on one ballot). Accept either as the "total cast" figure.
    const totalVotesMatch = block.match(
      /(\d[\d,]*)\s+(?:votes?|ballots?)\s*(?:\(|inc\.|cast|$)/i,
    );
    const totalVotes = totalVotesMatch ? parseIntComma(totalVotesMatch[1]) : null;

    const registeredMatch = block.match(/(\d[\d,]*)\s+registered\s+voters/i);
    const registeredVoters = registeredMatch
      ? parseIntComma(registeredMatch[1])
      : null;

    const turnoutMatch = block.match(/=\s*([\d.]+\s*%)\s+turnout/i);
    const turnout = turnoutMatch ? turnoutMatch[1].replace(/\s+/g, "") : null;

    const sources = extractBlockSources(block);

    records.push({
      year,
      electionName,
      role,
      date,
      seats,
      result,
      candidateVotes: candidateRow?.votes ?? null,
      candidatePercentage: candidateRow?.percentage ?? null,
      candidateRank: candidateRow?.rank ?? null,
      totalVotes,
      registeredVoters,
      turnout,
      allResults,
      sources,
      party: candidateRow?.party ?? null,
    });
  }

  return records.sort((a, b) => b.year - a.year);
}

/**
 * Extract the candidate's declared 2026 intention sentence and parse out
 * the parish / district when one is mentioned. flow.je phrases this as e.g.
 *   "Alvin Aaron has declared his intention to stand in the upcoming
 *    2026 Connétables Election in St Helier."
 */
export function extractDeclaredIntention(markdown: string): {
  text: string | null;
  district: string | null;
  role: string | null;
} {
  const cleaned = stripMarkdownLinks(markdown);
  const match = cleaned.match(
    /([A-Z][^.\n]*?has declared (?:his|her|their) intention to stand[^.\n]*\.)/i,
  );
  if (!match) return { text: null, district: null, role: null };

  const text = match[1].trim();

  const roleMatch = text.match(/\d{4}\s+([\w’'\s-]+?Election)/i);
  const role = roleMatch ? roleMatch[1].trim() : null;

  let district: string | null = null;
  for (const d of JERSEY_DISTRICTS) {
    const re = new RegExp(`\\bin\\s+${d.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(text)) {
      district = d;
      break;
    }
  }
  if (!district) {
    const districtMatch = text.match(
      /\bin\s+(District\s+\d+|St\s+\w+(?:\s+\w+)?|Trinity|Grouville)\b/i,
    );
    district = districtMatch ? districtMatch[1].trim() : null;
  }

  return { text, district, role };
}
