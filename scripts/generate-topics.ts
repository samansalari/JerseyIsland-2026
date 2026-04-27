/**
 * Generates AI summaries for all 10 policy topics.
 * Reads from candidates.ai_issues (must be populated first via fix:ai-issues).
 * Writes to topic_summaries table.
 *
 * Run: npm run generate:topics
 *      npm run generate:topics -- --issue=housing   (single topic)
 *      npm run generate:topics -- --dry-run         (no writes)
 */

import "./bootstrap-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql as sqlTag } from "drizzle-orm";
import {
  candidates,
  topicSummaries,
  type ThemeCluster,
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

// ── Config ────────────────────────────────────────────────────────────────────

const MODEL = process.env.GROK_MODEL?.trim() || DEFAULT_GROK_MODEL;
const DELAY_MS = 2000;

const TOPICS = [
  { issue: "housing",         displayName: "Housing" },
  { issue: "healthcare",      displayName: "Healthcare" },
  { issue: "tax",             displayName: "Tax" },
  { issue: "education",       displayName: "Education" },
  { issue: "environment",     displayName: "Environment" },
  { issue: "transport",       displayName: "Transport" },
  { issue: "cost_of_living",  displayName: "Cost of Living" },
  { issue: "immigration",     displayName: "Immigration" },
  { issue: "economy",         displayName: "Economy" },
  { issue: "public_services", displayName: "Public Services" },
] as const;

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const GROK_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY;

if (!DATABASE_URL) {
  console.error("[generate:topics] ✗ DATABASE_URL not set");
  process.exit(1);
}
if (!GROK_KEY?.trim()) {
  console.error(
    "[generate:topics] ✗ GROK_API_KEY (or XAI_API_KEY) not set — add to .env.local",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const issueFlag = args.find((a) => a.startsWith("--issue="))?.split("=")[1];
const isDryRun = args.includes("--dry-run");

console.log(`[generate:topics] Grok model: ${resolveGrokModelId(MODEL)}`);
if (isDryRun) console.log("[generate:topics] DRY RUN — no writes");

const pgClient = postgres(DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { candidates, topicSummaries } });

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a neutral political analyst synthesising candidate positions on a policy topic for Jersey's 2026 general election. You must be completely factual and non-partisan. Every claim must be directly supported by the candidate position data provided. Do not infer, extrapolate, or add information not present in the source data.

Return ONLY valid JSON, no markdown:
{
  "summary": "2-3 sentence neutral synthesis describing the overall landscape — what candidates generally support, where they differ",
  "consensus": "One sentence describing any shared ground across most candidates, or null if none clear",
  "divergence": "One sentence describing the main area of disagreement, or null if candidates broadly agree"
}`;

// Second pass: cluster the same positions into 4-8 thematic groups so the
// drawer can show "what candidates are actually saying" at a glance before
// listing every individual position card.
const CLUSTER_SYSTEM_PROMPT = `You are a neutral political analyst grouping Jersey 2026 candidate policy positions into clear thematic clusters. Be strictly factual — every theme must be supported by the supplied candidate text. Do not invent positions.

Rules:
- Identify 4-8 distinct themes from the supplied positions.
- A candidate may legitimately fit more than one theme — count them in each.
- Theme labels MUST be short (3-6 words), plain English, no jargon, no party names.
- For each theme, list 2-3 example candidate names (first names + surname is fine) drawn ONLY from the supplied list.
- Order themes by candidateCount descending.

Return ONLY valid JSON, no markdown, no commentary. Shape:
{
  "clusters": [
    { "theme": "short theme label", "candidateCount": number, "exampleNames": ["Name 1", "Name 2"] }
  ]
}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  // Verify we have ai_issues data
  const [check] = await db
    .select({ count: sqlTag<number>`COUNT(*)::int` })
    .from(candidates)
    .where(
      sqlTag`${candidates.aiIssues} IS NOT NULL AND jsonb_array_length(${candidates.aiIssues}) > 0`,
    );

  const enrichedCount = Number(check?.count ?? 0);
  console.log(`[generate:topics] Candidates with ai_issues data: ${enrichedCount}`);

  if (enrichedCount === 0) {
    console.error(
      "[generate:topics] ✗ No candidates have ai_issues data!\n" +
      "[generate:topics]   Run: npm run fix:ai-issues first",
    );
    process.exit(1);
  }

  // Fetch all candidates with non-empty ai_issues
  const allCandidates = await db
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

  console.log(
    `[generate:topics] Processing ${allCandidates.length} candidates across topics\n`,
  );

  // Filter topics if --issue flag provided
  const topicsToRun = issueFlag
    ? TOPICS.filter((t) => t.issue === issueFlag)
    : TOPICS;

  if (issueFlag && topicsToRun.length === 0) {
    console.error(`[generate:topics] ✗ Unknown issue slug "${issueFlag}"`);
    process.exit(1);
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (let idx = 0; idx < topicsToRun.length; idx++) {
    const topic = topicsToRun[idx]!;

    // Collect positions for this topic
    const positions: Array<{
      candidateName: string;
      slug: string;
      party: string | null;
      position: string;
      sourceQuote: string;
      confidence: number;
      manifestoUrl: string | null;
    }> = [];

    for (const candidate of allCandidates) {
      const issueList = Array.isArray(candidate.aiIssues)
        ? (candidate.aiIssues as Array<{
            issue: string;
            position: string;
            source_quote: string;
            confidence: number;
          }>)
        : [];

      const match = issueList.find(
        (i) => i.issue === topic.issue && i.confidence >= 0.4,
      );

      if (match?.position) {
        positions.push({
          candidateName: candidate.name,
          slug: candidate.slug,
          party: candidate.party,
          position: match.position,
          sourceQuote: match.source_quote ?? "",
          confidence: match.confidence,
          manifestoUrl: candidate.manifestoUrl,
        });
      }
    }

    if (positions.length === 0) {
      console.log(`  ${topic.issue}: 0 candidates — skipping`);
      skipped++;
      continue;
    }

    console.log(
      `  ${topic.issue}: ${positions.length} candidates — generating summary…`,
    );

    try {
      const positionsSummary = positions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 25)
        .map(
          (p) =>
            `${p.candidateName} (${p.party ?? "Independent"}): ${p.position}`,
        )
        .join("\n");

      const userPrompt = `Synthesise these candidate positions on "${topic.displayName}" for Jersey's 2026 election.

CANDIDATE POSITIONS:
${positionsSummary}

Return only the JSON object.`;

      const { data: result, usage } = await grokChatCompletionJson<{
        summary: string;
        consensus: string | null;
        divergence: string | null;
      }>({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        temperature: 0,
        maxTokens: 512,
        model: MODEL,
      });

      const rec = tokenTracker.record(
        `generate-topics:${topic.issue}`,
        usage.promptTokens,
        usage.completionTokens,
        usage.cachedTokens,
      );
      tokenTracker.printCall(rec);

      const fullSummary = [result.summary, result.consensus, result.divergence]
        .filter(Boolean)
        .join(" ");

      // Party breakdown
      const partyCounts: Record<string, number> = {};
      for (const p of positions) {
        const party = p.party ?? "Independent";
        partyCounts[party] = (partyCounts[party] ?? 0) + 1;
      }
      const topParties = Object.entries(partyCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([party, count]) => ({ party, count }));

      // Top sources by confidence
      const sourcesCited = positions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .map((p) => ({
          candidateName: p.candidateName,
          slug: p.slug,
          sourceQuote: p.sourceQuote,
          manifestoUrl: p.manifestoUrl,
        }));

      if (!isDryRun) {
        await db
          .update(topicSummaries)
          .set({
            aiSummary: fullSummary,
            candidateCount: positions.length,
            topParties,
            sourcesCited,
            generatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(topicSummaries.issue, topic.issue));
      }

      console.log(
        `  ✓ ${topic.issue}: ${isDryRun ? "DRY RUN — " : ""}summary written (${positions.length} candidates)`,
      );

      // ── Theme clusters (second Grok pass) ──────────────────────────────
      // Group the same positions into 4-8 themes so the issue drawer can
      // show a "Key themes" overview before the individual position cards.
      const clusterThreshold = Math.max(1, Math.ceil(positions.length * 0.1));
      let clustersWritten = 0;

      if (positions.length < 3) {
        if (!isDryRun) {
          await db
            .update(topicSummaries)
            .set({ themeClusters: [] })
            .where(eq(topicSummaries.issue, topic.issue));
        }
        console.log(
          `  · ${topic.issue}: only ${positions.length} positions — clusters skipped`,
        );
      } else {
        try {
          const positionsList = positions
            .map(
              (p, i) =>
                `${i + 1}. [${p.candidateName}]: ${p.position}`,
            )
            .join("\n");

          const clusterUserPrompt = `Issue: ${topic.displayName} (${topic.issue})
Total candidates with positions on this issue: ${positions.length}

Candidate positions (each numbered, name in brackets):
${positionsList}

Return only the JSON object described in the system instructions.`;

          const { data: clusterResult, usage: clusterUsage } =
            await grokChatCompletionJson<{ clusters: ThemeCluster[] }>({
              systemPrompt: CLUSTER_SYSTEM_PROMPT,
              userPrompt: clusterUserPrompt,
              temperature: 0,
              maxTokens: 800,
              model: MODEL,
            });

          const clusterRec = tokenTracker.record(
            `generate-topics:${topic.issue}:clusters`,
            clusterUsage.promptTokens,
            clusterUsage.completionTokens,
            clusterUsage.cachedTokens,
          );
          tokenTracker.printCall(clusterRec);

          const rawClusters = Array.isArray(clusterResult?.clusters)
            ? clusterResult.clusters
            : [];

          const validClusters: ThemeCluster[] = rawClusters
            .filter(
              (c): c is ThemeCluster =>
                !!c &&
                typeof c.theme === "string" &&
                c.theme.trim().length > 0 &&
                c.theme.length <= 60 &&
                typeof c.candidateCount === "number" &&
                c.candidateCount > 0 &&
                c.candidateCount <= positions.length,
            )
            .map((c) => ({
              theme: c.theme.trim(),
              candidateCount: Math.round(c.candidateCount),
              isMinority: c.candidateCount < clusterThreshold,
              exampleNames: Array.isArray(c.exampleNames)
                ? c.exampleNames
                    .filter(
                      (n): n is string =>
                        typeof n === "string" && n.trim().length > 0,
                    )
                    .slice(0, 3)
                : [],
            }))
            .sort((a, b) => b.candidateCount - a.candidateCount);

          if (!isDryRun) {
            await db
              .update(topicSummaries)
              .set({ themeClusters: validClusters })
              .where(eq(topicSummaries.issue, topic.issue));
          }

          clustersWritten = validClusters.length;
          console.log(
            `  ✓ ${topic.issue}: ${isDryRun ? "DRY RUN — " : ""}${clustersWritten} theme clusters generated`,
          );
        } catch (err) {
          console.error(
            `  ✗ ${topic.issue}: cluster generation failed —`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      generated++;
    } catch (err) {
      console.error(
        `  ✗ ${topic.issue}: FAILED —`,
        err instanceof Error ? err.message : err,
      );
      failed++;
    }

    if (idx < topicsToRun.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n[generate:topics] ═══════════════════════════`);
  console.log(`[generate:topics] Generated: ${generated}`);
  console.log(`[generate:topics] Skipped:   ${skipped}`);
  console.log(`[generate:topics] Failed:    ${failed}`);
  console.log(`[generate:topics] Time:      ${totalElapsed}s`);

  tokenTracker.printSummary();
  logTokenUsageToJsonl("generate-topics");

  await pgClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("[generate:topics] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
