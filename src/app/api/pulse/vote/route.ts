import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { issueVotes } from '@/db/schema'
import { and, eq, gte } from 'drizzle-orm'
import { createHash } from 'crypto'
import { headers } from 'next/headers'

const VALID_ISSUES = new Set([
  'housing',
  'healthcare',
  'cost_of_living',
  'environment',
  'economy',
  'education',
  'transport',
  'tax',
  'immigration',
  'public_services',
])

async function getFingerprint(): Promise<string> {
  const h = await headers()
  const ip = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? 'unknown'
  const ua = h.get('user-agent') ?? ''
  return createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 16)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { issue?: string }
    const { issue } = body

    if (!issue || !VALID_ISSUES.has(issue)) {
      return NextResponse.json({ error: 'Invalid issue' }, { status: 400 })
    }

    const fingerprint = await getFingerprint()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const existing = await db
      .select({ id: issueVotes.id })
      .from(issueVotes)
      .where(
        and(
          eq(issueVotes.voterFingerprint, fingerprint),
          gte(issueVotes.createdAt!, oneDayAgo),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'already_voted', message: 'You have already voted today' },
        { status: 429 },
      )
    }

    await db.insert(issueVotes).values({ issue, voterFingerprint: fingerprint })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[pulse/vote]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
