import { db } from '@/db'
import { candidates, topicSummaries } from '@/db/schema'
import { sql, isNotNull, isNull, and, count } from 'drizzle-orm'
import { EnrichmentClient } from './enrichment-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'AI Enrichment — Admin | VotePulse' }

export default async function AdminEnrichmentPage() {
  const [
    totalResult,
    enrichedResult,
    withIssuesResult,
    withManifestoResult,
    topicResult,
    unenrichedSample,
  ] = await Promise.all([
    db.select({ count: count() }).from(candidates),

    db.select({ count: count() })
      .from(candidates)
      .where(isNotNull(candidates.aiSummary)),

    db.select({ count: count() })
      .from(candidates)
      .where(
        sql`${candidates.aiIssues} IS NOT NULL
            AND ${candidates.aiIssues} != '[]'::jsonb`,
      ),

    db.select({ count: count() })
      .from(candidates)
      .where(isNotNull(candidates.manifestoRaw)),

    db.select({
      total: count(),
      withSummary: sql<number>`count(*) filter (
        where ${topicSummaries.aiSummary} is not null
      )`.mapWith(Number),
    }).from(topicSummaries),

    db.select({
      id: candidates.id,
      name: candidates.name,
      district: candidates.district,
    })
    .from(candidates)
    .where(
      and(
        isNotNull(candidates.manifestoRaw),
        isNull(candidates.aiSummary),
      ),
    )
    .limit(10),
  ])

  const total = Number(totalResult[0]?.count ?? 0)
  const enriched = Number(enrichedResult[0]?.count ?? 0)
  const withIssues = Number(withIssuesResult[0]?.count ?? 0)
  const withManifesto = Number(withManifestoResult[0]?.count ?? 0)
  const topicTotal = Number(topicResult[0]?.total ?? 0)
  const topicsGenerated = Number(topicResult[0]?.withSummary ?? 0)
  const pendingCount = withManifesto - enriched

  return (
    <div className="max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0D1B2A]">AI Enrichment</h1>
        <p className="text-sm text-[#0D1B2A]/60 mt-1">
          Manage Grok enrichment for candidates and topic summaries.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total candidates', value: total, colour: '#0D1B2A' },
          { label: 'AI summaries', value: enriched, colour: '#1A6B3A' },
          { label: 'Issues extracted', value: withIssues, colour: '#C8922A' },
          {
            label: 'Pending enrichment',
            value: pendingCount,
            colour: pendingCount > 0 ? '#A31621' : '#1A6B3A',
          },
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

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-[#0D1B2A]">
            Enrichment progress
          </span>
          <span
            className="text-sm font-bold"
            style={{ color: enriched === total ? '#1A6B3A' : '#C8922A' }}
          >
            {enriched}/{total} ({Math.round((enriched / Math.max(total, 1)) * 100)}%)
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-3 rounded-full transition-all"
            style={{
              width: `${(enriched / Math.max(total, 1)) * 100}%`,
              backgroundColor: enriched === total ? '#1A6B3A' : '#C8922A',
            }}
          />
        </div>
      </div>

      <EnrichmentClient
        pendingCount={pendingCount}
        unenrichedSample={unenrichedSample}
        topicTotal={topicTotal}
        topicsGenerated={topicsGenerated}
      />
    </div>
  )
}
