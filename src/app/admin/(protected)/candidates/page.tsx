import { db } from '@/db'
import { candidates } from '@/db/schema'
import { desc, sql } from 'drizzle-orm'
import { CandidatesTable } from './candidates-table'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Candidates — Admin | VotePulse' }

export default async function AdminCandidatesPage() {
  const rows = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      slug: candidates.slug,
      district: candidates.district,
      party: candidates.party,
      hasManifesto: sql<boolean>`(${candidates.manifestoRaw} IS NOT NULL)`,
      hasSummary: sql<boolean>`(${candidates.aiSummary} IS NOT NULL)`,
      issueCount: sql<number>`
        CASE
          WHEN ${candidates.aiIssues} IS NOT NULL
            AND ${candidates.aiIssues} != '[]'::jsonb
          THEN jsonb_array_length(${candidates.aiIssues})
          ELSE 0
        END`,
      lastEnrichedAt: candidates.lastEnrichedAt,
      updatedAt: candidates.updatedAt,
    })
    .from(candidates)
    .orderBy(desc(candidates.updatedAt))

  const total = rows.length
  const enriched = rows.filter(r => r.hasSummary).length
  const withIssues = rows.filter(r => Number(r.issueCount) > 0).length
  const withManifesto = rows.filter(r => r.hasManifesto).length

  return (
    <div className="max-w-full px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0D1B2A]">Candidates</h1>
          <p className="text-sm text-[#0D1B2A]/60 mt-1">
            {total} total · {enriched} enriched · {withIssues} with issues
            · {withManifesto} with manifesto
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: total, colour: '#0D1B2A' },
          { label: 'Have manifesto', value: withManifesto, colour: '#C8922A' },
          { label: 'AI summaries', value: enriched, colour: '#1A6B3A' },
          { label: 'Issues extracted', value: withIssues, colour: '#A31621' },
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

      <CandidatesTable rows={rows} />
    </div>
  )
}
