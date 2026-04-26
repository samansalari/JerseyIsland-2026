'use server'

import { db } from '@/db'
import { candidates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { runRepoScript } from '@/lib/admin-exec'
import { mergeCronState } from '@/lib/admin-cron-state'

export async function reEnrichCandidate(candidateId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Unauthorized' }

  const [row] = await db
    .select({ slug: candidates.slug })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1)

  if (!row) return { ok: false as const, error: 'Candidate not found' }

  const outcome = await runRepoScript('scripts/enrich.ts', [
    `--candidate-slug=${row.slug}`,
  ])

  mergeCronState({
    lastEnrichment: new Date().toISOString(),
    lastEnrichmentResult: outcome.ok ? 'success' : 'fail',
  })

  if (!outcome.ok) {
    const tail = outcome.output.split('\n').filter(Boolean).pop() ?? 'Script failed'
    return { ok: false as const, error: tail }
  }
  return { ok: true as const }
}
