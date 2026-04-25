/**
 * Re-runs ONLY the issue extraction step for candidates that already have
 * ai_summary but have ai_issues = [] or NULL.
 *
 * Does NOT re-generate summaries (already done, expensive).
 * Writes back to candidates.ai_issues AND candidate_issues junction table.
 *
 * Run: npm run fix:ai-issues
 *      npm run fix:ai-issues -- --candidate-slug=marie-le-breton  (single)
 *      npm run fix:ai-issues -- --dry-run                         (no writes)
 */

import "./bootstrap-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, isNotNull, sql as sqlTag } from "drizzle-orm";
import {
  candidates,
  issues,
  candidateIssues,
} from "../src/db/schema";
import {
  grokChatCompletionJson,
  DEFAULT_GROK_MODEL,
  resolveGrokModelId,
} from "../src/lib/grok";
import {
  logTokenUsageToJsonl,
  tokenTracker,
} from "../src/lib/token-tracker";

// ── Config ───────────────────────────────────────────────────────────────────

const MODEL = process.env.GROK_MODEL?.trim() || DEFAULT_GROK_MODEL;
const DELAY_MS = 500;

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

// ── Bootstrap ────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const GROK_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY;

if (!DATABASE_URL) {
  console.error("[fix:ai-issues] ✗ DATABASE_URL not set");
  process.exit(1);
}
if (!GROK_KEY?.trim()) {
  console.error(
    "[fix:ai-issues] ✗ GROK_API_KEY (or XAI_API_KEY) not set — add to .env.local",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const slugFlag = args.find((a) => a.startsWith("--candidate-slug="))?.split("=")[1];
const isDryRun = args.includes("--dry-run");

console.log(`[fix:ai-issues] Grok model: ${resolveGrokModelId(MODEL)}`);
if (isDryRun) console.log("[fix:ai-issues] DRY RUN — no writes");

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { candidates, issues, candidateIssues } });

// ── Prompts ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are extracting policy position signals from Jersey election candidate profiles.

The text may be a full policy manifesto OR a biographical history (election history, committee roles, party membership, past positions). Work with WHATEVER content is provided. Extract policy signals from ALL available evidence.

SIGNAL SOURCES — use all of these:
1. Explicit policy statements (highest confidence)
2. Party membership signals:
   - Reform Jersey members: known to support housing reform, progressive taxation, workers rights, public services expansion, cost-of-living action, environmental protection
   - Island identity / independent conservatives: tend to support financial industry, controlled immigration, limited government spending
3. Committee or ministerial roles (e.g. "Transport Minister" → transport expertise; "Housing Minister" → housing position)
4. Issues mentioned as reasons for standing in the 2026 election
5. Past manifesto themes referenced in the text (e.g. "2022 Vote.je Manifesto" links — assume they addressed related issues)
6. Geographic representation (St Helier deputies often prioritise housing and urban transport)

Issues to extract:
- housing: housing policy, affordable homes, rental market, planning, homelessness
- healthcare: health service, waiting times, mental health, GPs, hospital
- tax: income tax, GST, business tax, rates, fiscal policy, public finances
- education: schools, universities, skills, training, childcare
- environment: climate, green energy, pollution, wildlife, carbon neutrality
- transport: roads, buses, cycling, parking, infrastructure, harbour, airport
- cost_of_living: inflation, wages, cost of goods, affordability, household pressures
- immigration: migration policy, population growth, work permits, residency, CHW Law
- economy: business, employment, economic growth, finance sector, diversification
- public_services: government services, police, fire, social care, accountability

Return ONLY valid JSON. No markdown. No preamble. No explanation:
{
  "issues": [
    {
      "issue": "housing",
      "position": "Candidate's inferred or stated stance in 1-2 sentences",
      "source_quote": "Best available quote or phrase from the text, or party/role basis if inferred (max 150 chars)",
      "confidence": 0.7
    }
  ]
}

Confidence guide:
- 0.85–1.0: Explicit policy statement in the text
- 0.65–0.84: Clear party signal or ministerial role directly related to the issue
- 0.45–0.64: Indirect signal (geographic, general party alignment, vague reference)
- Below 0.45: Do not include

Extract AS MANY RELEVANT ISSUES AS POSSIBLE from the available evidence. It is better to extract a reasonable inferred position (confidence 0.65) than to return nothing. Only return {"issues": []} if there is literally no signal at all — no party, no role, no policy mention, no geographic context.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Core extraction ───────────────────────────────────────────────────────────

interface IssuePosition {
  issue: string;
  position: string;
  source_quote: string;
  confidence: number;
}

async function extractIssues(
  candidateName: string,
  manifestoRaw: string,
): Promise<IssuePosition[]> {
  const userPrompt = `Extract ALL policy position signals for this Jersey 2026 election candidate.

CANDIDATE: ${candidateName}

PROFILE / MANIFESTO TEXT:
---
${manifestoRaw.slice(0, 4000)}
---

INSTRUCTIONS:
- This may be a biographical profile, not a full manifesto. That is fine.
- Use ALL available signals: party membership, committee roles, district represented, stated intentions, past manifesto references.
- Infer positions where evidence is clear (e.g. Reform Jersey member = progressive housing stance).
- Aim for at least 2-4 issues where any signal exists.
- Return only the JSON object.`;

  const { data, usage } = await grokChatCompletionJson<{ issues: IssuePosition[] }>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0,
    maxTokens: 600,
    model: MODEL,
  });

  const rec = tokenTracker.record(
    `fix-issues:${candidateName}`,
    usage.promptTokens,
    usage.completionTokens,
    usage.cachedTokens,
  );
  tokenTracker.printCall(rec);

  const raw = data.issues ?? [];

  return raw.filter(
    (item) =>
      VALID_ISSUES.has(item.issue) &&
      typeof item.position === "string" &&
      item.position.trim().length > 0 &&
      typeof item.confidence === "number" &&
      item.confidence >= 0 &&
      item.confidence <= 1,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  // Load issue UUID map for junction table
  const issueRows = await db.select({ id: issues.id, name: issues.name }).from(issues);
  const issueIdMap = new Map(issueRows.map((i) => [i.name, i.id]));

  if (issueRows.length === 0) {
    console.error(
      "[fix:ai-issues] ✗ issues table is empty! Run: npm run db:seed first.",
    );
    process.exit(1);
  }
  console.log(`[fix:ai-issues] issues table: ${issueRows.length} rows\n`);

  // Select candidates to fix
  let toFix: Array<{
    id: string;
    name: string;
    slug: string;
    manifestoRaw: string | null;
    aiSummary: string | null;
  }>;

  if (slugFlag) {
    toFix = await db
      .select({
        id: candidates.id,
        name: candidates.name,
        slug: candidates.slug,
        manifestoRaw: candidates.manifestoRaw,
        aiSummary: candidates.aiSummary,
      })
      .from(candidates)
      .where(eq(candidates.slug, slugFlag));

    if (toFix.length === 0) {
      console.error(`[fix:ai-issues] ✗ No candidate with slug "${slugFlag}"`);
      process.exit(1);
    }
  } else {
    // All candidates with ai_summary but empty/null ai_issues
    toFix = await db
      .select({
        id: candidates.id,
        name: candidates.name,
        slug: candidates.slug,
        manifestoRaw: candidates.manifestoRaw,
        aiSummary: candidates.aiSummary,
      })
      .from(candidates)
      .where(
        and(
          isNotNull(candidates.aiSummary),
          isNotNull(candidates.manifestoRaw),
          sqlTag`(${candidates.aiIssues} IS NULL OR jsonb_array_length(${candidates.aiIssues}) = 0)`,
        ),
      );
  }

  console.log(`[fix:ai-issues] Found ${toFix.length} candidate(s) to fix\n`);

  let fixed = 0;
  let failed = 0;
  let noContent = 0;

  for (let idx = 0; idx < toFix.length; idx++) {
    const candidate = toFix[idx]!;
    const prefix = `[${idx + 1}/${toFix.length}] ${candidate.name}`;

    if (!candidate.manifestoRaw || candidate.manifestoRaw.trim().length < 50) {
      console.log(`${prefix} — SKIP (manifesto too short)`);
      noContent++;
      continue;
    }

    try {
      const validated = await extractIssues(candidate.name, candidate.manifestoRaw);

      if (isDryRun) {
        console.log(
          `${prefix} — DRY RUN ✓ would write ${validated.length} issues: ${validated.map((v) => v.issue).join(", ") || "none"}`,
        );
        fixed++;
        continue;
      }

      // Write to candidates.ai_issues
      await db
        .update(candidates)
        .set({
          aiIssues: validated.map((i) => ({
            issue: i.issue,
            position: i.position,
            confidence: i.confidence,
            source_quote: i.source_quote,
          })),
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, candidate.id));

      // Write to candidate_issues junction table
      if (validated.length > 0 && issueIdMap.size > 0) {
        const rows = validated
          .map((vi) => {
            const issueId = issueIdMap.get(vi.issue);
            if (!issueId) return null;
            return {
              candidateId: candidate.id,
              issueId,
              position: vi.position,
              sourceQuote: vi.source_quote ?? "",
              confidence: vi.confidence,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (rows.length > 0) {
          // Delete stale entries then insert fresh
          await db
            .delete(candidateIssues)
            .where(eq(candidateIssues.candidateId, candidate.id));

          await db.insert(candidateIssues).values(rows);
        }
      }

      console.log(
        `${prefix} — ✓ ${validated.length} issues: ${validated.map((v) => v.issue).join(", ") || "none"}`,
      );
      fixed++;
    } catch (err) {
      console.error(
        `${prefix} — ✗ FAILED:`,
        err instanceof Error ? err.message : err,
      );
      failed++;
    }

    if (idx < toFix.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n[fix:ai-issues] ══════════════════════════════`);
  console.log(`[fix:ai-issues] Fixed:      ${fixed}`);
  console.log(`[fix:ai-issues] Failed:     ${failed}`);
  console.log(`[fix:ai-issues] Skipped:    ${noContent}`);
  console.log(`[fix:ai-issues] Total time: ${totalElapsed}s`);

  tokenTracker.printSummary();
  logTokenUsageToJsonl("fix-ai-issues");

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[fix:ai-issues] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
