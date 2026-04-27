import { db } from "@/db";
import { candidates, issueVotes, pulseInsights } from "@/db/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { grokChatCompletionJson } from "@/lib/grok";

type AiIssue = { issue: string; position: string; confidence: number };

const INSIGHT_TYPE = "issue_summary" as const;

/**
 * Build Public Pulse text insight from current poll data + candidate positions.
 * Invoked on a 6-hour schedule (see `scripts/cron.ts`) and from admin.
 */
export async function generatePulseInsight() {
  const voteCounts = await db
    .select({
      issue: issueVotes.issue,
      count: sql<number>`count(*)::int`,
    })
    .from(issueVotes)
    .groupBy(issueVotes.issue)
    .orderBy(desc(sql`count(*)`));

  if (voteCounts.length === 0) {
    console.log("[pulse-insight] No votes yet, skipping");
    return;
  }

  const total = voteCounts.reduce((s, v) => s + v.count, 0);
  const top3 = voteCounts.slice(0, 3);
  const topKeys = new Set(top3.map((v) => v.issue));

  const enrichedCandidates = await db
    .select({
      name: candidates.name,
      district: candidates.district,
      aiIssues: candidates.aiIssues,
    })
    .from(candidates)
    .where(and(isNotNull(candidates.aiIssues), eq(candidates.is2026, true)))
    .limit(50);

  const relevantCandidates = enrichedCandidates
    .filter((c) => {
      if (!c.aiIssues || !Array.isArray(c.aiIssues)) return false;
      return (c.aiIssues as AiIssue[]).some(
        (i) => topKeys.has(i.issue) && i.confidence > 0.6,
      );
    })
    .slice(0, 5);

  const systemPrompt = `You are a neutral political analyst writing about Jersey's 2026 election.
Use clear, neutral British English. Do not mention AI, models, software, or technology.`;

  const userPrompt = `Jersey issue poll (share of recorded votes, rounded):
${top3
  .map(
    (v) =>
      `- ${v.issue.replace(/_/g, " ")}: ${Math.round((v.count / total) * 100)}%`,
  )
  .join("\n")}

${
  relevantCandidates.length > 0
    ? `Candidates with stated positions on these issues: ${relevantCandidates.map((c) => c.name).join(", ")}`
    : ""
}

Write a 2-3 sentence neutral analysis of what these results suggest about Jersey voter priorities.
Return JSON only, exactly: {"analysis":"your text here"}`;

  const { data } = await grokChatCompletionJson<{ analysis: string }>({
    systemPrompt,
    userPrompt,
    temperature: 0,
    maxTokens: 200,
  });

  await db
    .delete(pulseInsights)
    .where(eq(pulseInsights.insightType, INSIGHT_TYPE));

  await db.insert(pulseInsights).values({
    insightType: INSIGHT_TYPE,
    content: data.analysis,
  });

  console.log(
    `[pulse-insight] Saved (${data.analysis.slice(0, 80)}${data.analysis.length > 80 ? "…" : ""})`,
  );
}
