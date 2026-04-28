import "./bootstrap-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  eq,
  isNull,
  or,
  lt,
  and,
  isNotNull,
  sql as sqlTag,
} from "drizzle-orm";
import {
  candidates,
  candidateIssues,
  issues,
  snapshots,
  topicSummaries,
  type ActionPoint,
  type IssueStance,
} from "../src/db/schema";
import {
  type GrokUsage,
  DEFAULT_GROK_MODEL,
  grokChatCompletionJson,
  resolveGrokModelId,
} from "../src/lib/grok";
import {
  logTokenUsageToJsonl,
  tokenTracker,
} from "../src/lib/token-tracker";
import {
  cleanCandidateData,
  looksLikeDirtyData,
} from "../src/lib/candidate-cleaner";

/**
 * VotePulse — Candidate Enrichment Pipeline
 *
 * Reads manifestos → calls xAI Grok → writes AI summaries, issue positions,
 * and snapshots to Postgres. Idempotent: re-running refreshes stale data
 * without duplicating.
 *
 * Usage:
 *   npx tsx scripts/enrich.ts
 *   npx tsx scripts/enrich.ts --candidate-slug=marie-le-breton
 *
 * Requires:
 *   GROK_API_KEY (or XAI_API_KEY) in env (or .env.local)
 *   DATABASE_URL in env (or .env.local)
 */

// ── Config ──────────────────────────────────────────────────────────────────

const MODEL = process.env.GROK_MODEL?.trim() || DEFAULT_GROK_MODEL;
const DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;
const STALE_DAYS = 7;

const VALID_ISSUES = new Set([
  "housing",
  "healthcare",
  "tax",
  "education",
  "environment",
  "transport",
  "cost_of_living",
  "immigration",
  "economy",
  "public_services",
]);

// ── Bootstrap ───────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const GROK_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY;

if (!DATABASE_URL) {
  console.error("[enrich] ✗ DATABASE_URL not set");
  process.exit(1);
}
if (!GROK_KEY?.trim()) {
  console.error(
    "[enrich] ✗ GROK_API_KEY (or XAI_API_KEY) not set — add to .env.local",
  );
  process.exit(1);
}

console.log(`[enrich] Grok model: ${resolveGrokModelId(MODEL)}`);

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, {
  schema: { candidates, candidateIssues, issues, snapshots },
});

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Shape of the single Grok JSON response. Wraps the issue array inside an
 * object because `extractJsonObject` requires the response to start with `{`.
 * Action points and stance type are the new structured outputs.
 */
interface EnrichmentResult {
  summary: string;
  key_promises: string[];
  issues: Array<
    {
      issue: string;
      position: string;
      source_quote: string;
      confidence: number;
    } & Partial<Pick<IssueStance, "stanceType" | "actionPoints">>
  >;
  election_history?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function revalidateCandidate(slug: string): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const secret = process.env.REVALIDATION_SECRET?.trim();
  if (!siteUrl || !secret) return;

  try {
    await fetch(`${siteUrl}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        paths: [`/candidates/${slug}`, "/candidates", "/sitemap.xml"],
      }),
    });
  } catch {
    /* non-fatal — ISR will refresh on the next cycle */
  }
}

/** Fuzzy substring match — returns similarity ratio 0–1. */
function fuzzyMatch(needle: string, haystack: string): number {
  const n = needle.toLowerCase().replace(/\s+/g, " ").trim();
  const h = haystack.toLowerCase().replace(/\s+/g, " ").trim();
  if (h.includes(n)) return 1.0;
  // Simple longest-common-subsequence ratio
  const lcs = lcsLength(n, h);
  return lcs / n.length;
}

function lcsLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return 0;
  // Space-optimised LCS (only need 2 rows)
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]! + 1;
      } else {
        curr[j] = Math.max(prev[j]!, curr[j - 1]!);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev.reduce((max, v) => Math.max(max, v), 0);
}

type ManifestoGrokResult = {
  result: EnrichmentResult;
  usage: GrokUsage;
};

// ── Grok prompt (action-points extraction) ─────────────────────────────────
//
// New pipeline (Apr 2026): Grok extracts a structured `actionPoints` list per
// issue alongside the existing `position` summary. The wrapper
// `grokChatCompletionJson` slices the response from `{` to `}`, so the schema
// must remain a top-level JSON object — the issues array lives inside it.

const ISSUE_EXTRACTION_SYSTEM = `You are a political analyst extracting policy positions from Jersey election candidate manifestos.

Jersey's 2026 general election is on 7 June 2026. You are reading a candidate's manifesto or electoral profile.

Your task: Extract specific, concrete policy positions for each of the 10 issue categories below.

CRITICAL RULES:

1. ACTION POINTS — the most important output:
   Extract specific things the candidate says they will DO or SUPPORT or OPPOSE.
   These must be CONCRETE and SPECIFIC — not vague.

   GOOD action points (specific, concrete):
   "Build 500 affordable homes by 2028"
   "Introduce rent controls for private sector"
   "Reduce GP waiting times to under 48 hours"
   "Ring-fence education budget at 25% of States spending"

   BAD action points (too vague — DO NOT extract these):
   "Support better healthcare"
   "Help with housing"
   "Focus on the economy"
   "Improve services"

2. STANCE TYPE — classify the candidate's overall stance per issue:
   "supportive" — actively proposes specific action on this issue
   "opposing" — explicitly opposes a current policy or proposal
   "concerned" — raises the issue but offers no specific solution
   "neutral" — mentions the issue without taking a position

3. SOURCE QUOTES — every action point needs a verbatim quote from the manifesto
   that supports it. Short quotes (10-30 words) are better than long ones.

4. ONLY EXTRACT what is explicitly stated in the manifesto.
   DO NOT infer, assume, or extrapolate positions not in the text.
   DO NOT extract action points from previous elections if this is a historical manifesto.
   If a candidate doesn't mention an issue — return nothing for that issue.

5. HISTORICAL MANIFESTOS — if the manifesto starts with "[Historical manifesto",
   this is from a previous election. Still extract positions but note they may
   be outdated. Do not fabricate 2026-specific commitments.

6. HISTORICAL ELECTION DATA — the profile text may contain election results
   tables from previous elections (vote counts, percentages, ranks). IGNORE
   these. They are not policy positions. Past election outcomes are not
   evidence of a stance on any issue.

ISSUE CATEGORIES (only use these exact slugs):
- housing: Housing supply, affordability, rent, first-time buyers, social housing
- healthcare: NHS/hospital, GPs, mental health, waiting times, healthcare access
- tax: Income tax, GST, corporation tax, rates, fiscal policy
- education: Schools, teachers, university, skills, apprenticeships
- environment: Climate, marine, green spaces, carbon, sustainability
- transport: Roads, buses, cycling, parking, ferry, airport
- cost_of_living: Inflation, wages, energy bills, food costs, affordability
- immigration: Population policy, work permits, migration, residency
- economy: Business, finance sector, jobs, diversification, investment
- public_services: States services, social care, parish services, government efficiency

Return ONLY valid JSON. No markdown. No preamble.`;

function buildIssueExtractionUserPrompt(
  candidateName: string,
  district: string,
  manifesto: string,
): string {
  return `Extract policy positions for candidate: ${candidateName} (district: ${district}).

MANIFESTO TEXT:
---
${manifesto.slice(0, 8000)}
---

Return ONLY a JSON object with this exact shape (no markdown, no preamble):

{
  "summary": "2-3 sentence neutral summary of who this person is and their 2026 platform. If info is sparse, summarise their background and declared intention to stand.",
  "key_promises": ["short list of headline pledges, may be empty"],
  "election_history": "brief summary of past elections if present, or empty string",
  "issues": [
    {
      "issue": "<one of the 10 slugs above>",
      "position": "<one sentence summary of their overall stance>",
      "confidence": <0.0-1.0 — how clearly this is stated>,
      "source_quote": "<primary supporting verbatim quote>",
      "stanceType": "<supportive|opposing|concerned|neutral>",
      "actionPoints": [
        {
          "text": "<specific concrete action point, max 15 words>",
          "type": "<action|commitment|opposition|concern>",
          "sourceQuote": "<verbatim quote supporting this specific point>"
        }
      ]
    }
  ]
}

Rules:
- Only include issues that are explicitly mentioned in the manifesto text above.
- If fewer than 2 action points can be extracted for an issue, still include
  the issue entry but with an empty actionPoints array and an appropriate
  stanceType (typically "concerned" or "neutral").
- Every "source_quote" and every actionPoints[].sourceQuote MUST be a verbatim
  string copied from the manifesto text — do not paraphrase.
- Return "issues": [] if no relevant policy positions are found.`;
}

/** Call Grok with one retry on parse / transport failure. */
async function callGrokForManifesto(
  candidateName: string,
  district: string,
  manifestoRaw: string,
): Promise<ManifestoGrokResult> {
  const systemPrompt = ISSUE_EXTRACTION_SYSTEM;
  const userPrompt = buildIssueExtractionUserPrompt(
    candidateName,
    district,
    manifestoRaw,
  );

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, usage } = await grokChatCompletionJson<EnrichmentResult>({
        systemPrompt,
        userPrompt,
        temperature: 0,
        // More tokens than before — action points add significant output volume.
        maxTokens: 6000,
        model: MODEL,
      });
      return { result: data, usage };
    } catch (err) {
      if (attempt === 0) {
        console.warn(
          `  ⚠ Attempt 1 failed for ${candidateName}: ${err instanceof Error ? err.message : err}`,
        );
        console.warn(`  ⚠ Retrying in ${RETRY_DELAY_MS / 1000}s…`);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw err;
      }
    }
  }

  throw new Error("Unreachable");
}

// ── Validation helpers (action-points pipeline) ────────────────────────────

const VALID_STANCE_TYPES = new Set<NonNullable<IssueStance["stanceType"]>>([
  "supportive",
  "opposing",
  "concerned",
  "neutral",
]);

const VALID_ACTION_TYPES = new Set<ActionPoint["type"]>([
  "action",
  "commitment",
  "opposition",
  "concern",
]);

/**
 * Validate + normalise one Grok-returned issue entry into the persisted
 * `IssueStance` shape. Returns `null` if the entry is malformed or refers to
 * an unknown issue slug.
 */
function validateIssueStance(
  raw: EnrichmentResult["issues"][number],
): IssueStance | null {
  if (!raw || typeof raw !== "object") return null;
  if (!VALID_ISSUES.has(raw.issue)) return null;
  if (typeof raw.position !== "string") return null;

  const position = raw.position.trim();
  if (position.length <= 10) return null;

  const confidenceRaw = Number(raw.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0.5;

  const sourceQuote =
    typeof raw.source_quote === "string" ? raw.source_quote.trim() : "";

  const stanceType: NonNullable<IssueStance["stanceType"]> =
    raw.stanceType && VALID_STANCE_TYPES.has(raw.stanceType)
      ? raw.stanceType
      : "neutral";

  const rawActionPoints = Array.isArray(raw.actionPoints)
    ? raw.actionPoints
    : [];

  const actionPoints: ActionPoint[] = rawActionPoints
    .filter(
      (ap): ap is ActionPoint =>
        !!ap &&
        typeof (ap as ActionPoint).text === "string" &&
        (ap as ActionPoint).text.trim().length > 5 &&
        (ap as ActionPoint).text.trim().length < 200,
    )
    // Cap at 6 per issue — keeps cards scannable and the jsonb column small.
    .slice(0, 6)
    .map((ap) => ({
      text: ap.text.trim().slice(0, 150),
      type: VALID_ACTION_TYPES.has(ap.type) ? ap.type : "action",
      sourceQuote:
        typeof ap.sourceQuote === "string"
          ? ap.sourceQuote.trim().slice(0, 300)
          : "",
    }));

  return {
    issue: raw.issue,
    position: position.slice(0, 300),
    confidence,
    source_quote: sourceQuote.slice(0, 500),
    stanceType,
    actionPoints,
  };
}

// ── Per-candidate enrichment (used by default + --batch) ────────────────────

type CandidateRow = (typeof candidates.$inferSelect);

async function enrichOneCandidate(
  candidateArg: CandidateRow,
  issueMap: Map<string, string>,
): Promise<"processed" | "failed" | "skipped"> {
  let candidate = candidateArg;
  const t0 = Date.now();
  console.log(
    `[enrich] Processing: ${candidate.name} (${candidate.district})`,
  );

  // ── Step 1: Data Quality Gate ─────────────────────────────────────────────
  // Before enrichment, strip website boilerplate, emails, nav text, and URLs
  // that Firecrawl may have captured alongside the actual candidate content.
  if (looksLikeDirtyData(candidate.name, candidate.bio, candidate.manifestoRaw)) {
    console.log(`  [cleaner] Dirty data detected — running AI clean`);
    try {
      const cleaned = await cleanCandidateData({
        rawName: candidate.name,
        rawBio: candidate.bio,
        rawManifesto: candidate.manifestoRaw,
        sourceUrl:
          candidate.manifestoUrl ?? (candidate.sourceUrls?.[0] ?? null),
      });

      if (cleaned.wasModified) {
        if (cleaned.issues.length > 0) {
          console.log(`  [cleaner] Fixed: ${cleaned.issues.join(", ")}`);
        }
        await db
          .update(candidates)
          .set({
            name: cleaned.name,
            bio: cleaned.bio,
            manifestoRaw: cleaned.manifestoRaw,
            updatedAt: new Date(),
          })
          .where(eq(candidates.id, candidate.id));

        // Reload with clean data so the enrichment step sees it
        const [refreshed] = await db
          .select()
          .from(candidates)
          .where(eq(candidates.id, candidate.id))
          .limit(1);
        if (refreshed) {
          candidate = { ...candidate, ...refreshed };
        }
      } else {
        console.log(`  [cleaner] No changes needed`);
      }
      await sleep(1000);
    } catch (cleanErr) {
      console.warn(
        `  [cleaner] Warning — cleaner failed (continuing): ${cleanErr instanceof Error ? cleanErr.message : cleanErr}`,
      );
    }
  }

  if (!candidate.manifestoRaw) {
    console.log(`  ⏭ Skipped — no manifesto_raw`);
    return "skipped";
  }

  try {
    const { result: gr, usage } = await callGrokForManifesto(
      candidate.name,
      candidate.district,
      candidate.manifestoRaw,
    );

    const rec = tokenTracker.record(
      `enrich:candidate:${candidate.slug}`,
      usage.promptTokens,
      usage.completionTokens,
      usage.cachedTokens,
    );
    tokenTracker.printCall(rec);

    const validated: IssueStance[] = [];
    for (const entry of gr.issues ?? []) {
      const stance = validateIssueStance(entry);
      if (!stance) {
        if (entry?.issue && !VALID_ISSUES.has(entry.issue)) {
          console.warn(`  ⚠ Unknown issue "${entry.issue}" — skipping`);
        }
        continue;
      }

      // Source-quote spot check (warning only — Grok occasionally trims
      // whitespace or normalises punctuation, so we don't drop the entry).
      if (stance.source_quote && candidate.manifestoRaw) {
        const matchScore = fuzzyMatch(stance.source_quote, candidate.manifestoRaw);
        if (matchScore < 0.7) {
          console.warn(
            `  ⚠ Source quote for "${stance.issue}" has low match (${(matchScore * 100).toFixed(0)}%) — flagging`,
          );
        }
      }

      validated.push(stance);
    }

    const totalActionPoints = validated.reduce(
      (n, s) => n + (s.actionPoints?.length ?? 0),
      0,
    );

    await db.insert(snapshots).values({
      entityType: "candidate",
      entityId: candidate.id,
      data: {
        ai_summary: candidate.aiSummary,
        ai_issues: candidate.aiIssues,
        last_enriched_at: candidate.lastEnrichedAt,
      },
    });

    const now = new Date();
    const summary = gr.summary?.trim() || null;
    try {
      await db
        .update(candidates)
        .set({
          aiSummary: summary,
          aiIssues: validated,
          lastEnrichedAt: now,
          updatedAt: now,
          // Schema changed — old supervisor scores are no longer meaningful.
          // Re-enrichment requires a fresh review pass (`review:summaries`).
          reviewStatus: null,
          lastReviewedAt: null,
        })
        .where(eq(candidates.id, candidate.id));
    } catch (error) {
      console.error("[ERROR] DB save failed:", error);
      throw error;
    }

    for (const entry of validated) {
      const issueId = issueMap.get(entry.issue);
      if (!issueId) {
        console.warn(
          `  ⚠ Issue "${entry.issue}" not in issues table — skipping junction row`,
        );
        continue;
      }

      await db
        .insert(candidateIssues)
        .values({
          candidateId: candidate.id,
          issueId,
          position: entry.position,
          sourceQuote: entry.source_quote,
          confidence: entry.confidence,
        })
        .onConflictDoUpdate({
          target: [candidateIssues.candidateId, candidateIssues.issueId],
          set: {
            position: sqlTag`excluded.position`,
            sourceQuote: sqlTag`excluded.source_quote`,
            confidence: sqlTag`excluded.confidence`,
          },
        });
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `  ✓ Done — ${validated.length} issues, ${totalActionPoints} action points extracted (${elapsed}s)`,
    );
    await revalidateCandidate(candidate.slug);
    return "processed";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Failed: ${msg}`);
    return "failed";
  }
}

// ── Topic-level synthesis ────────────────────────────────────────────────────

const ISSUE_NAMES = [
  "housing",
  "healthcare",
  "tax",
  "education",
  "environment",
  "transport",
  "cost_of_living",
  "immigration",
  "economy",
  "public_services",
] as const;

type IssueName = (typeof ISSUE_NAMES)[number];

interface CandidatePosition {
  candidateName: string;
  slug: string;
  party: string | null;
  position: string;
  sourceQuote: string;
  confidence: number;
  manifestoUrl: string | null;
}

async function generateTopicSummaries() {
  console.log("\n=== GENERATING TOPIC SUMMARIES ===");

  const enrichedCandidates = await db
    .select({
      name: candidates.name,
      slug: candidates.slug,
      party: candidates.party,
      aiIssues: candidates.aiIssues,
      manifestoUrl: candidates.manifestoUrl,
    })
    .from(candidates)
    .where(
      sqlTag`${candidates.aiIssues} IS NOT NULL AND jsonb_array_length(${candidates.aiIssues}) > 0`,
    );

  for (const issue of ISSUE_NAMES) {
    const positions: CandidatePosition[] = [];

    for (const candidate of enrichedCandidates) {
      const issueList = Array.isArray(candidate.aiIssues)
        ? (candidate.aiIssues as Array<{
            issue: string;
            position: string;
            source_quote: string;
            confidence: number;
          }>)
        : [];
      const issueData = issueList.find((i) => i.issue === issue);

      if (issueData && issueData.confidence > 0.4) {
        positions.push({
          candidateName: candidate.name,
          slug: candidate.slug,
          party: candidate.party,
          position: issueData.position,
          sourceQuote: issueData.source_quote,
          confidence: issueData.confidence,
          manifestoUrl: candidate.manifestoUrl,
        });
      }
    }

    if (positions.length === 0) {
      console.log(`  ${issue}: no candidates with positions, skipping`);
      continue;
    }

    const positionsSummary = positions
      .slice(0, 20)
      .map(
        (p) =>
          `${p.candidateName} (${p.party ?? "Independent"}): "${p.position}"`,
      )
      .join("\n");

    const systemPrompt = `You are a neutral political analyst synthesising candidate positions on a policy topic for Jersey's 2026 general election. You must be completely factual and non-partisan. Every claim must be directly supported by the candidate position data provided. Do not infer or extrapolate. Never hallucinate or add information not in the source data.`;

    const userPrompt = `Synthesise the following candidate positions on "${issue.replace(/_/g, " ")}" into a 2-3 sentence neutral summary that describes the overall landscape — what candidates generally support, where they differ, and any notable consensus.

CANDIDATE POSITIONS:
${positionsSummary}

Return ONLY a JSON object, no markdown:
{
  "summary": "2-3 sentence neutral synthesis of the landscape",
  "consensus": "One sentence describing any shared ground, or null if none",
  "divergence": "One sentence describing the main area of disagreement, or null if all agree"
}`;

    try {
      const { data: result } = await grokChatCompletionJson<{
        summary: string;
        consensus: string | null;
        divergence: string | null;
      }>({
        systemPrompt,
        userPrompt,
        temperature: 0,
        maxTokens: 512,
        model: MODEL,
      });

      const sourcesCited = positions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .map((p) => ({
          candidateName: p.candidateName,
          slug: p.slug,
          sourceQuote: p.sourceQuote,
          manifestoUrl: p.manifestoUrl,
        }));

      const partyCounts: Record<string, number> = {};
      for (const p of positions) {
        const party = p.party ?? "Independent";
        partyCounts[party] = (partyCounts[party] ?? 0) + 1;
      }
      const topParties = Object.entries(partyCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([party, count]) => ({ party, count }));

      const fullSummary = [result.summary, result.consensus, result.divergence]
        .filter(Boolean)
        .join(" ");

      await db
        .update(topicSummaries)
        .set({
          aiSummary: fullSummary,
          candidateCount: positions.length,
          sourcesCited,
          topParties,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(topicSummaries.issue, issue));

      console.log(
        `  ✓ ${issue}: ${positions.length} candidates, summary generated`,
      );
    } catch (err) {
      console.error(`  ✗ ${issue}: failed to generate summary`, err);
    }

    await sleep(2000);
  }

  console.log("=== TOPIC SUMMARIES COMPLETE ===\n");
}

async function revalidateHomepage(): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const secret = process.env.REVALIDATION_SECRET?.trim();
  if (!siteUrl || !secret) return;

  try {
    await fetch(`${siteUrl}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        paths: ["/", "/candidates"],
      }),
    });
    console.log("  ✓ Revalidated / and /candidates");
  } catch {
    /* non-fatal */
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  // Accept either `--candidate-slug=foo` (legacy) or the shorter `--slug=foo`.
  const slugFlag = args
    .find((a) => a.startsWith("--candidate-slug=") || a.startsWith("--slug="))
    ?.split("=")[1];
  // `--force` re-enriches every candidate with a manifesto regardless of
  // staleness or prior enrichment. Used after schema changes (e.g. adding
  // structured action points) to backfill the entire cohort in one pass.
  const forceFlag = args.includes("--force");
  /** Restrict `--force` / `--batch` to 2026 standing candidates only. */
  const is2026Flag = args.includes("--is2026");

  const issueRows = await db.select().from(issues);
  const issueMap = new Map(issueRows.map((i) => [i.name, i.id]));

  const staleDate = new Date(Date.now() - STALE_DAYS * 86400_000);

  let query = db.select().from(candidates);
  let rows: CandidateRow[];

  if (slugFlag) {
    rows = await query.where(eq(candidates.slug, slugFlag));
    if (rows.length === 0) {
      console.error(`[enrich] ✗ No candidate found with slug "${slugFlag}"`);
      process.exit(1);
    }
    if (!rows[0]!.manifestoRaw) {
      console.error(
        `[enrich] ✗ Candidate "${slugFlag}" has no manifesto_raw. Seed it first.`,
      );
      process.exit(1);
    }
  } else if (forceFlag) {
    rows = await query.where(
      and(
        isNotNull(candidates.manifestoRaw),
        ...(is2026Flag ? [eq(candidates.is2026, true)] : []),
      ),
    );
    console.log(
      `[enrich] --force enabled — re-enriching every candidate with a manifesto${is2026Flag ? " (is2026 only)" : ""}`,
    );
  } else {
    rows = await query.where(
      and(
        isNotNull(candidates.manifestoRaw),
        or(
          isNull(candidates.aiSummary),
          lt(candidates.lastEnrichedAt, staleDate),
        ),
      ),
    );
  }

  console.log(`[enrich] Found ${rows.length} candidate(s) to process\n`);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of rows) {
    const outcome = await enrichOneCandidate(candidate, issueMap);
    if (outcome === "processed") processed++;
    else if (outcome === "failed") failed++;
    else skipped++;

    if (rows.indexOf(candidate) < rows.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[enrich] ══════════════════════════════════════`);
  console.log(`[enrich] Processed: ${processed}`);
  console.log(`[enrich] Failed:    ${failed}`);
  console.log(`[enrich] Skipped:   ${skipped}`);
  console.log(`[enrich] Total:     ${totalElapsed}s`);

  tokenTracker.printSummary();
  logTokenUsageToJsonl("enrich");

  await pgClient.end({ timeout: 5 });
}

// ── Topics-only: regenerate summaries without re-enriching candidates ────────
if (process.argv.includes("--topics-only")) {
  (async () => {
    console.log("\n=== TOPIC SUMMARIES ONLY ===\n");
    await generateTopicSummaries();
    await revalidateHomepage();
    tokenTracker.printSummary();
    logTokenUsageToJsonl("enrich:topics");
    await pgClient.end({ timeout: 5 });
    process.exit(0);
  })().catch(async (err) => {
    console.error("[enrich] ✗ Topics fatal:", err);
    await pgClient.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  });
} else if (process.argv.includes("--batch")) {
  (async () => {
    const batchIs2026 = process.argv.includes("--is2026");
    console.log("\n=== GROK BATCH ENRICHMENT ===\n");
    const issueRows = await db.select().from(issues);
    const issueMap = new Map(issueRows.map((i) => [i.name, i.id]));

    const unenriched = await db
      .select()
      .from(candidates)
      .where(
        and(
          isNotNull(candidates.manifestoRaw),
          isNull(candidates.aiSummary),
          ...(batchIs2026 ? [eq(candidates.is2026, true)] : []),
        ),
      );

    console.log(`Found ${unenriched.length} candidates to enrich\n`);

    let done = 0;
    let failed = 0;
    let i = 0;
    for (const candidate of unenriched) {
      i++;
      console.log(`[${i}/${unenriched.length}] ${candidate.name}`);
      try {
        const outcome = await enrichOneCandidate(candidate, issueMap);
        if (outcome === "processed") done++;
        else if (outcome === "failed") failed++;
      } catch (e) {
        console.error(`  ❌ Failed: ${candidate.name}:`, e);
        failed++;
      }
      await sleep(2000);
    }

    console.log(`\n=== BATCH COMPLETE ===`);
    console.log(`Enriched: ${done}`);
    console.log(`Failed  : ${failed}`);

    await generateTopicSummaries();
    await revalidateHomepage();

    tokenTracker.printSummary();
    logTokenUsageToJsonl("enrich:batch");
    await pgClient.end({ timeout: 5 });
    process.exit(0);
  })().catch(async (err) => {
    console.error("[enrich] ✗ Batch fatal:", err);
    await pgClient.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  });
} else {
  main().catch(async (err) => {
    console.error("[enrich] ✗ Fatal:", err);
    await pgClient.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  });
}
