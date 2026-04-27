import { db } from '@/db'
import { issueVotes, candidateRatings, pulseInsights, topicFeedback } from '@/db/schema'
import { sql, count, desc } from 'drizzle-orm'
import { PulseAdminClient } from './pulse-admin-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Public Pulse — Admin | VotePulse' }

export default async function AdminPulsePage() {
  const [
    totalVotesResult,
    totalRatingsResult,
    votesByIssue,
    latestInsight,
    feedbackByType,
  ] = await Promise.all([
    db.select({ count: count() }).from(issueVotes),

    db.select({ count: count() }).from(candidateRatings),

    db.select({
      issue: issueVotes.issue,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(issueVotes)
    .groupBy(issueVotes.issue)
    .orderBy(sql`count(*) desc`),

    db.select({
      id: pulseInsights.id,
      insightType: pulseInsights.insightType,
      content: pulseInsights.content,
      generatedAt: pulseInsights.generatedAt,
    })
    .from(pulseInsights)
    .orderBy(desc(pulseInsights.generatedAt))
    .limit(1),

    db.select({
      feedbackType: topicFeedback.feedbackType,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(topicFeedback)
    .groupBy(topicFeedback.feedbackType)
    .orderBy(sql`count(*) desc`),
  ])

  const votes = Number(totalVotesResult[0]?.count ?? 0)
  const ratings = Number(totalRatingsResult[0]?.count ?? 0)
  const insight = latestInsight[0] ?? null

  return (
    <div className="max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0D1B2A]">Public Pulse</h1>
        <p className="text-sm text-[#0D1B2A]/60 mt-1">
          Monitor and manage public voting data and AI insights.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total votes', value: votes, colour: '#A31621' },
          { label: 'Total ratings', value: ratings, colour: '#C8922A' },
          { label: 'Issues tracked', value: votesByIssue.length, colour: '#0D1B2A' },
        ].map(s => (
          <div key={s.label}
            className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-2xl font-bold" style={{ color: s.colour }}>
              {s.value}
            </div>
            <div className="text-xs text-[#0D1B2A]/60 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {votesByIssue.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="font-semibold text-[#0D1B2A] text-sm mb-4">
            Votes by issue
          </h3>
          <div className="space-y-2">
            {votesByIssue.map(row => {
              const pct = votes > 0 ? Math.round((row.count / votes) * 100) : 0
              return (
                <div key={row.issue} className="flex items-center gap-3">
                  <div className="w-32 text-xs text-[#0D1B2A]/70 capitalize
                                  truncate flex-shrink-0">
                    {row.issue.replace(/_/g, ' ')}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-[#A31621]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-20 text-xs text-right text-[#0D1B2A]/60">
                    {row.count} ({pct}%)
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {insight ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#0D1B2A] text-sm">
              Latest AI Insight
            </h3>
            {insight.generatedAt && (
              <span className="text-xs text-[#0D1B2A]/40">
                {new Date(insight.generatedAt).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg
                          text-sm text-[#0D1B2A]/80 leading-relaxed">
            {insight.content}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <p className="text-sm text-[#0D1B2A]/50 text-center py-4">
            No insight generated yet. Click &ldquo;Regenerate Insight&rdquo; below.
          </p>
        </div>
      )}

      {feedbackByType.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="font-semibold text-[#0D1B2A] text-sm mb-4">
            Feedback by type
          </h3>
          <div className="space-y-2">
            {feedbackByType.map(row => (
              <div
                key={row.feedbackType}
                className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0"
              >
                <span className="text-sm text-[#0D1B2A]/70 capitalize">
                  {row.feedbackType.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-semibold text-[#0D1B2A]">
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <PulseAdminClient hasData={votes > 0 || ratings > 0} />
    </div>
  )
}
