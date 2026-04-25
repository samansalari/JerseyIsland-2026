import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { candidateRatings } from '@/db/schema'
import { and, eq, gte } from 'drizzle-orm'
import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody, ratingSchema } from '@/lib/validate'

async function getFingerprint(): Promise<string> {
  const h = await headers()
  const ip = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? 'unknown'
  const ua = h.get('user-agent') ?? ''
  return createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 16)
}

export async function POST(req: NextRequest) {
  const { success, response: rlResponse } = await checkRateLimit(req, 10, 60)
  if (!success) return rlResponse!

  try {
    const body = await req.json().catch(() => ({}))
    const validated = validateBody(ratingSchema, body)
    if ('error' in validated) return validated.error
    const { candidateId, rating } = validated.data

    const fingerprint = await getFingerprint()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const existing = await db
      .select({ id: candidateRatings.id })
      .from(candidateRatings)
      .where(
        and(
          eq(candidateRatings.voterFingerprint, fingerprint),
          eq(candidateRatings.candidateId, candidateId),
          gte(candidateRatings.createdAt!, oneDayAgo),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'already_rated', message: 'Already rated today' },
        { status: 429 },
      )
    }

    await db
      .insert(candidateRatings)
      .values({ candidateId, rating, voterFingerprint: fingerprint })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[pulse/rate]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
