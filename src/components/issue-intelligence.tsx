// Server component — fetches topic data at ISR render time
// The interactive sheet/drawer opens client-side via IssueSheet

import { db, sql as pgClient } from "@/db";
import { topicSummaries, topicUpvotes } from "@/db/schema";
import { count } from "drizzle-orm";
import { IssueSheet } from "./issue-sheet";

export interface TopicData {
  issue: string;
  displayName: string;
  icon: string;
  aiSummary: string | null;
  candidateCount: number;    // live count from candidates.ai_issues
  samplePosition: string | null; // highest-confidence sample quote from ai_issues
  upvoteCount: number;
  topParties: { party: string; count: number }[] | null;
}

export async function IssueIntelligence() {
  let topics: TopicData[] = [];

  try {
    const [summaries, upvoteCounts, issueCounts] = await Promise.all([
      db.select().from(topicSummaries),

      db
        .select({ issue: topicUpvotes.issue, total: count() })
        .from(topicUpvotes)
        .groupBy(topicUpvotes.issue),

      // Live candidate counts direct from ai_issues jsonb — works even when
      // topic_summaries.candidate_count is 0 (not yet synced).
      pgClient<
        { issue: string; candidate_count: string; sample_position: string | null }[]
      >`
        SELECT
          issue_item->>'issue'  AS issue,
          COUNT(*)::text        AS candidate_count,
          (
            SELECT elem->>'position'
            FROM   candidates c2,
                   jsonb_array_elements(c2.ai_issues) elem
            WHERE  elem->>'issue' = issue_item->>'issue'
              AND  (elem->>'confidence')::float > 0.6
            ORDER  BY (elem->>'confidence')::float DESC
            LIMIT  1
          ) AS sample_position
        FROM   candidates,
               jsonb_array_elements(ai_issues) AS issue_item
        WHERE  ai_issues IS NOT NULL
          AND  ai_issues != '[]'::jsonb
          AND  (issue_item->>'confidence')::float >= 0.4
        GROUP  BY issue_item->>'issue'
      `,
    ]);

    const upvoteMap = new Map(
      upvoteCounts.map((u) => [u.issue, Number(u.total)]),
    );

    const issueCountMap = new Map(
      issueCounts.map((r) => [
        r.issue,
        {
          count: Number(r.candidate_count),
          samplePosition: r.sample_position ?? null,
        },
      ]),
    );

    topics = summaries.map((s) => {
      const live = issueCountMap.get(s.issue) ?? { count: 0, samplePosition: null };
      return {
        issue: s.issue,
        displayName: s.displayName,
        icon: s.icon,
        aiSummary: s.aiSummary,
        // Prefer live count from ai_issues; fall back to stored value
        candidateCount: live.count > 0 ? live.count : (s.candidateCount ?? 0),
        samplePosition: live.samplePosition,
        upvoteCount: upvoteMap.get(s.issue) ?? 0,
        topParties: s.topParties as { party: string; count: number }[] | null,
      };
    });

    // Most upvoted / most discussed first; break ties by candidate count
    topics.sort(
      (a, b) =>
        b.upvoteCount - a.upvoteCount || b.candidateCount - a.candidateCount,
    );
  } catch {
    // Allows next build when Postgres is not reachable (CI / preview)
  }

  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      {/* Section header */}
      <div className="mb-10">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-0.5 w-8 bg-gold" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-gold">
            Policy Intelligence
          </span>
        </div>
        <h2 className="text-[26px] font-bold leading-tight tracking-tight text-navy md:text-[30px]">
          What are candidates planning?
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          Explore what Jersey&apos;s 2026 candidates say about the issues that
          matter. Every position is AI-extracted directly from their manifestos
          — with source quotes you can verify.
        </p>
      </div>

      {/* Topic grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {topics.map((topic) => (
          <IssueSheet key={topic.issue} topic={topic} />
        ))}
      </div>

      {/* AI disclaimer */}
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 px-5 py-4">
        <svg
          viewBox="0 0 20 20"
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6Zm0 9a1 1 0 100-2 1 1 0 000 2Z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          All summaries and candidate positions are AI-generated from publicly
          available manifesto text. Every claim links to the original source
          quote. Content refreshes every 6 hours. Always verify with official
          candidate materials.
        </p>
      </div>
    </section>
  );
}
