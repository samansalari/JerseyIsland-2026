import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  candidates,
  topicSummaries,
  topicUpvotes,
  topicFeedback,
} from "@/db/schema";
import { count, isNotNull, sql } from "drizzle-orm";

// CRITICAL: force-dynamic so stats are always live, never cached
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Dashboard | VotePulse",
  robots: { index: false, follow: false },
};

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  // ── Fetch all stats in parallel ─────────────────────────────────────
  const [
    totalCandidatesResult,
    enrichedCandidatesResult,
    candidatesWithIssuesResult,
    candidatesWithManifestoResult,
    topicSummariesResult,
    topicUpvotesResult,
    topicFeedbackResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(candidates),

    db
      .select({ count: count() })
      .from(candidates)
      .where(isNotNull(candidates.aiSummary)),

    db
      .select({ count: count() })
      .from(candidates)
      .where(
        sql`${candidates.aiIssues} IS NOT NULL AND ${candidates.aiIssues} != '[]'::jsonb`,
      ),

    db
      .select({ count: count() })
      .from(candidates)
      .where(isNotNull(candidates.manifestoRaw)),

    db
      .select({
        total: count(),
        withSummary: sql<number>`count(*) filter (where ${topicSummaries.aiSummary} is not null)`.mapWith(
          Number,
        ),
      })
      .from(topicSummaries),

    db.select({ count: count() }).from(topicUpvotes),

    db.select({ count: count() }).from(topicFeedback),
  ]);

  // ── Extract values ───────────────────────────────────────────────────
  const totalCandidates = Number(totalCandidatesResult[0]?.count ?? 0);
  const enrichedCount = Number(enrichedCandidatesResult[0]?.count ?? 0);
  const withIssuesCount = Number(candidatesWithIssuesResult[0]?.count ?? 0);
  const withManifesto = Number(candidatesWithManifestoResult[0]?.count ?? 0);
  const topicTotal = Number(topicSummariesResult[0]?.total ?? 0);
  const topicsGenerated = Number(topicSummariesResult[0]?.withSummary ?? 0);
  const totalUpvotes = Number(topicUpvotesResult[0]?.count ?? 0);
  const totalFeedback = Number(topicFeedbackResult[0]?.count ?? 0);

  const enrichmentRate =
    totalCandidates > 0
      ? Math.round((enrichedCount / totalCandidates) * 100)
      : 0;

  // ── Most recently enriched candidate ────────────────────────────────
  const [lastEnriched] = await db
    .select({
      name: candidates.name,
      lastEnrichedAt: candidates.lastEnrichedAt,
    })
    .from(candidates)
    .where(isNotNull(candidates.lastEnrichedAt))
    .orderBy(sql`${candidates.lastEnrichedAt} desc nulls last`)
    .limit(1);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0D1B2A]">
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Signed in as <strong>{user.email}</strong>
            {" · "}
            <span className="text-gray-400">
              Live data — refreshes on each page load
            </span>
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-[#A31621] hover:underline"
        >
          View live site ↗
        </a>
      </div>

      {/* ── Candidate stats ─────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">
          Candidates
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              value: totalCandidates,
              label: "Total candidates",
              colour: "#0D1B2A",
              sublabel: "in database",
            },
            {
              value: withManifesto,
              label: "Have manifesto",
              colour: "#C8922A",
              sublabel: `${Math.round((withManifesto / Math.max(totalCandidates, 1)) * 100)}% of total`,
            },
            {
              value: enrichedCount,
              label: "AI summaries",
              colour: "#1A6B3A",
              sublabel: `${enrichmentRate}% enriched`,
            },
            {
              value: withIssuesCount,
              label: "Issues extracted",
              colour: "#A31621",
              sublabel: "non-empty ai_issues",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
            >
              <div
                className="text-3xl font-bold leading-none mb-1"
                style={{ color: stat.colour }}
              >
                {stat.value.toLocaleString()}
              </div>
              <div className="text-xs font-semibold text-gray-700 mt-1">
                {stat.label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.sublabel}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Enrichment progress bar ──────────────────────────────── */}
      <section className="mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[#0D1B2A]">
              Enrichment progress
            </span>
            <span className="text-sm font-bold text-[#1A6B3A]">
              {enrichedCount} / {totalCandidates} candidates
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full transition-all"
              style={{
                width: `${enrichmentRate}%`,
                backgroundColor:
                  enrichmentRate === 100
                    ? "#1A6B3A"
                    : enrichmentRate > 50
                      ? "#C8922A"
                      : "#A31621",
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>0</span>
            <span>{enrichmentRate}% complete</span>
            <span>{totalCandidates}</span>
          </div>
          {lastEnriched?.lastEnrichedAt && (
            <p className="text-xs text-gray-400 mt-2">
              Last enriched:{" "}
              <strong className="text-gray-600">{lastEnriched.name}</strong>
              {" at "}
              {new Date(lastEnriched.lastEnrichedAt).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </section>

      {/* ── Policy Intelligence stats ────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">
          Policy Intelligence (Homepage Topics)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              value: topicTotal,
              label: "Topics seeded",
              colour: "#0D1B2A",
              sublabel: "of 10 configured",
            },
            {
              value: topicsGenerated,
              label: "AI summaries ready",
              colour: topicsGenerated === 0 ? "#A31621" : "#1A6B3A",
              sublabel:
                topicsGenerated === 0
                  ? "Run: generate:topics"
                  : `${topicsGenerated} of ${topicTotal}`,
            },
            {
              value: totalUpvotes,
              label: "Topic upvotes",
              colour: "#C8922A",
              sublabel: "anonymous signals",
            },
            {
              value: totalFeedback,
              label: "Feedback submitted",
              colour: "#0D1B2A",
              sublabel: "accuracy reports",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
            >
              <div
                className="text-3xl font-bold leading-none mb-1"
                style={{ color: stat.colour }}
              >
                {stat.value.toLocaleString()}
              </div>
              <div className="text-xs font-semibold text-gray-700 mt-1">
                {stat.label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.sublabel}</div>
            </div>
          ))}
        </div>

        {/* Warning if topics not generated */}
        {topicsGenerated === 0 && topicTotal > 0 && (
          <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-700">
              <strong>⚠ Topic summaries not generated.</strong>
              {" "}The homepage Policy Intelligence section shows "No data yet"
              for all tiles. After April 27 (official candidate list day), run:
              <code className="ml-2 bg-amber-100 px-1.5 py-0.5 rounded text-xs">
                npm run fix:ai-issues &amp;&amp; npm run generate:topics
              </code>
            </p>
          </div>
        )}
      </section>

      {/* ── Quick actions ────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">
          Quick Actions
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              title: "Browse candidates",
              desc: "View all 135 candidate profiles",
              href: "/candidates",
              external: false,
            },
            {
              title: "Supabase dashboard",
              desc: "Edit data, run SQL queries",
              href: "https://app.supabase.com",
              external: true,
            },
            {
              title: "Railway logs",
              desc: "Check cron worker + deployment",
              href: "https://railway.app",
              external: true,
            },
          ].map((action) => (
            <a
              key={action.title}
              href={action.href}
              target={action.external ? "_blank" : undefined}
              rel={action.external ? "noopener noreferrer" : undefined}
              className="block bg-white rounded-2xl border border-gray-200 p-5
                         hover:border-[#A31621] hover:shadow-sm transition-all group"
            >
              <div
                className="font-semibold text-[#0D1B2A] group-hover:text-[#A31621]
                              transition-colors text-sm mb-1"
              >
                {action.title}
                {action.external && (
                  <span className="ml-1 text-gray-300">↗</span>
                )}
              </div>
              <div className="text-xs text-gray-500">{action.desc}</div>
            </a>
          ))}
        </div>
      </section>

      {/* ── Data pipeline status ──────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">
          Pipeline Status
        </h2>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="space-y-3">
            {[
              {
                label: "Candidates with manifesto_raw",
                value: `${withManifesto} / ${totalCandidates}`,
                status:
                  withManifesto === totalCandidates ? "good" : "warn",
              },
              {
                label: "Candidates with AI summary",
                value: `${enrichedCount} / ${totalCandidates}`,
                status: enrichedCount > 0 ? "good" : "error",
              },
              {
                label: "Candidates with issue positions",
                value: `${withIssuesCount} / ${totalCandidates}`,
                status: withIssuesCount > 0 ? "good" : "warn",
              },
              {
                label: "Topic summaries generated",
                value: `${topicsGenerated} / ${topicTotal}`,
                status:
                  topicsGenerated === topicTotal && topicTotal > 0
                    ? "good"
                    : "warn",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-2
                                              border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-600">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0D1B2A]">
                    {row.value}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      row.status === "good"
                        ? "bg-[#1A6B3A]"
                        : row.status === "warn"
                          ? "bg-[#C8922A]"
                          : "bg-[#A31621]"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 mt-4">
            ℹ Topic summaries show NULL until April 27 (official candidate list
            day) — this is expected and correct.
          </p>
        </div>
      </section>
    </div>
  );
}
