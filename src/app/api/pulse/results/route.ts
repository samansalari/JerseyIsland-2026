import { NextResponse } from 'next/server'
import { db } from '@/db'
import { issueVotes, candidateRatings, candidates } from '@/db/schema'
import { sql, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Issue vote counts
    const issueResults = await db
      .select({
        issue: issueVotes.issue,
        count: sql<number>`count(*)::int`,
      })
      .from(issueVotes)
      .groupBy(issueVotes.issue)
      .orderBy(desc(sql`count(*)`))

    const totalVotes = issueResults.reduce((s, r) => s + r.count, 0)

    // Top rated candidates (min 3 ratings)
    const topRated = await db
      .select({
        candidateId: candidateRatings.candidateId,
        name: candidates.name,
        slug: candidates.slug,
        district: candidates.district,
        party: candidates.party,
        avgRating: sql<number>`round(avg(${candidateRatings.rating})::numeric, 1)`,
        totalRatings: sql<number>`count(*)::int`,
      })
      .from(candidateRatings)
      .innerJoin(candidates, eq(candidates.id, candidateRatings.candidateId))
      .groupBy(
        candidateRatings.candidateId,
        candidates.name,
        candidates.slug,
        candidates.district,
        candidates.party,
      )
      .having(sql`count(*) >= 3`)
      .orderBy(desc(sql`avg(${candidateRatings.rating})`))
      .limit(10)

    return NextResponse.json({ issueResults, totalVotes, topRated })
  } catch (e) {
    console.error('[pulse/results]', e)
    return NextResponse.json(
      { issueResults: [], totalVotes: 0, topRated: [] },
      { status: 500 },
    )
  }
}
