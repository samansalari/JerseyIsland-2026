import type { Metadata } from 'next'
import { db } from '@/db'
import { candidates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { PublicPulseClient } from './pulse-client'

export const metadata: Metadata = {
  title: 'Public Pulse — Jersey 2026 | VotePulse',
  description:
    'What matters most to Jersey voters? Share your opinion and see live results.',
}

export const revalidate = 30

export default async function TrendsPage() {
  const allCandidates = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      slug: candidates.slug,
      district: candidates.district,
      party: candidates.party,
    })
    .from(candidates)
    .where(eq(candidates.is2026, true))
    .orderBy(candidates.name)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F5F0' }}>
      <PublicPulseClient candidates={allCandidates} />
    </div>
  )
}
