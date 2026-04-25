import { db } from "@/db";
import {
  candidates,
  issueVotes,
  candidateRatings,
  articles,
} from "@/db/schema";
import { sql, isNotNull, isNull, count, desc } from "drizzle-orm";
import { AdminActions } from "@/components/admin/admin-actions";
import { AdminLegacyPanel } from "../admin-legacy-panel";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    const [
      totalCandidates,
      enrichedCandidates,
      pendingEnrichment,
      totalVotes,
      totalRatings,
      totalArticles,
    ] = await Promise.all([
      db.select({ count: count() }).from(candidates),
      db
        .select({ count: count() })
        .from(candidates)
        .where(isNotNull(candidates.aiSummary)),
      db
        .select({ count: count() })
        .from(candidates)
        .where(isNull(candidates.aiSummary)),
      db.select({ count: count() }).from(issueVotes),
      db.select({ count: count() }).from(candidateRatings),
      db.select({ count: count() }).from(articles),
    ]);

    const topIssues = await db
      .select({
        issue: issueVotes.issue,
        voteCount: sql<number>`count(*)::int`,
      })
      .from(issueVotes)
      .groupBy(issueVotes.issue)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    return {
      totalCandidates: totalCandidates[0]?.count ?? 0,
      enrichedCandidates: enrichedCandidates[0]?.count ?? 0,
      pendingEnrichment: pendingEnrichment[0]?.count ?? 0,
      totalVotes: totalVotes[0]?.count ?? 0,
      totalRatings: totalRatings[0]?.count ?? 0,
      totalArticles: totalArticles[0]?.count ?? 0,
      topIssues,
    };
  } catch {
    return {
      totalCandidates: 0,
      enrichedCandidates: 0,
      pendingEnrichment: 0,
      totalVotes: 0,
      totalRatings: 0,
      totalArticles: 0,
      topIssues: [],
    };
  }
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const statCards = [
    {
      label: "Total Candidates",
      value: stats.totalCandidates,
      color: "#0D1B2A",
      icon: "👤",
    },
    {
      label: "AI Enriched",
      value: stats.enrichedCandidates,
      color: "#1A6B3A",
      icon: "✅",
    },
    {
      label: "Pending Enrichment",
      value: stats.pendingEnrichment,
      color: "#C8922A",
      icon: "⏳",
    },
    {
      label: "Poll Votes",
      value: stats.totalVotes,
      color: "#A31621",
      icon: "🗳️",
    },
    {
      label: "Candidate Ratings",
      value: stats.totalRatings,
      color: "#6B4C9A",
      icon: "⭐",
    },
    {
      label: "Articles Indexed",
      value: stats.totalArticles,
      color: "#1565C0",
      icon: "📰",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#0D1B2A" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(13,27,42,0.5)" }}>
          VotePulse — Jersey 2026 · Admin Control Panel
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl p-6"
            style={{
              backgroundColor: "#fff",
              border: "1px solid rgba(13,27,42,0.08)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{stat.icon}</span>
              <span
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: "rgba(13,27,42,0.4)" }}
              >
                {stat.label}
              </span>
            </div>
            <p
              className="text-3xl font-black tabular-nums"
              style={{ color: stat.color }}
            >
              {stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions + Top issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div
          className="rounded-2xl p-6"
          style={{
            backgroundColor: "#fff",
            border: "1px solid rgba(13,27,42,0.08)",
          }}
        >
          <h2 className="font-bold mb-4" style={{ color: "#0D1B2A" }}>
            ⚡ Quick Actions
          </h2>
          <AdminActions />
        </div>

        <div
          className="rounded-2xl p-6"
          style={{
            backgroundColor: "#fff",
            border: "1px solid rgba(13,27,42,0.08)",
          }}
        >
          <h2 className="font-bold mb-4" style={{ color: "#0D1B2A" }}>
            🗳️ Top Poll Issues
          </h2>
          {stats.topIssues.length === 0 ? (
            <p className="text-sm" style={{ color: "rgba(13,27,42,0.4)" }}>
              No votes yet
            </p>
          ) : (
            <div className="space-y-2">
              {stats.topIssues.map((issue, i) => (
                <div
                  key={issue.issue}
                  className="flex items-center justify-between"
                >
                  <span
                    className="text-sm font-medium capitalize"
                    style={{ color: "#0D1B2A" }}
                  >
                    {i + 1}. {issue.issue.replace(/_/g, " ")}
                  </span>
                  <span
                    className="text-sm font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(163,22,33,0.08)",
                      color: "#A31621",
                    }}
                  >
                    {issue.voteCount} votes
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legacy detailed panel */}
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: "#fff",
          border: "1px solid rgba(13,27,42,0.08)",
        }}
      >
        <h2 className="font-bold mb-4" style={{ color: "#0D1B2A" }}>
          🔧 Detailed Management
        </h2>
        <AdminLegacyPanel />
      </div>
    </div>
  );
}
