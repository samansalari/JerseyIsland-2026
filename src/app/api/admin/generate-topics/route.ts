import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { runRepoScript } from '@/lib/admin-exec'
import { mergeCronState } from '@/lib/admin-cron-state'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const outcome = await runRepoScript('scripts/generate-topics.ts')

  mergeCronState({
    lastEnrichment: new Date().toISOString(),
    lastEnrichmentResult: outcome.ok ? 'success' : 'fail',
  })

  return NextResponse.json({
    ok: outcome.ok,
    message: outcome.ok
      ? 'Topic summaries generated.'
      : 'Topic generation failed — check logs.',
    outputTail: outcome.output.split('\n').slice(-40).join('\n'),
  })
}
