import { db } from '@/db'
import { candidates } from '@/db/schema'
import { max, sql } from 'drizzle-orm'
import { ScrapersClient } from './scrapers-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Scrapers — Admin | VotePulse' }

export default async function AdminScrapersPage() {
  const [stats] = await db
    .select({
      lastScraped: max(candidates.lastScrapedAt),
      lastEnriched: max(candidates.lastEnrichedAt),
      total: sql<number>`count(*)`,
    })
    .from(candidates)

  return (
    <div className="max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0D1B2A]">Scrapers</h1>
        <p className="text-sm text-[#0D1B2A]/60 mt-1">
          Trigger data collection scripts. Long jobs may timeout on the web server —
          use the Railway worker for batch operations.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-[#0D1B2A]/50 uppercase tracking-wider mb-1">
            Last scraped
          </div>
          <div className="text-sm font-semibold text-[#0D1B2A]">
            {stats?.lastScraped
              ? new Date(stats.lastScraped).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })
              : 'Never'}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-[#0D1B2A]/50 uppercase tracking-wider mb-1">
            Last enriched
          </div>
          <div className="text-sm font-semibold text-[#0D1B2A]">
            {stats?.lastEnriched
              ? new Date(stats.lastEnriched).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })
              : 'Never'}
          </div>
        </div>
      </div>

      <ScrapersClient />
    </div>
  )
}
