'use client'

import { useState } from 'react'

type Props = {
  pendingCount: number
  unenrichedSample: Array<{ id: string; name: string; district: string }>
  topicTotal: number
  topicsGenerated: number
}

export function EnrichmentClient({
  pendingCount,
  unenrichedSample,
  topicTotal,
  topicsGenerated,
}: Props) {
  const [batchStatus, setBatchStatus] = useState<
    'idle' | 'running' | 'done' | 'error'
  >('idle')
  const [batchMessage, setBatchMessage] = useState('')

  const [topicStatus, setTopicStatus] = useState<
    'idle' | 'running' | 'done' | 'error'
  >('idle')
  const [topicMessage, setTopicMessage] = useState('')

  const [insightStatus, setInsightStatus] = useState<
    'idle' | 'running' | 'done' | 'error'
  >('idle')

  async function runBatchEnrich() {
    setBatchStatus('running')
    setBatchMessage('')
    try {
      const res = await fetch('/api/admin/enrich-batch', { method: 'POST' })
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      setBatchStatus(data.ok ? 'done' : 'error')
      setBatchMessage(data.message ?? data.error ?? '')
    } catch (err) {
      setBatchStatus('error')
      setBatchMessage(String(err))
    }
  }

  async function runGenerateTopics() {
    setTopicStatus('running')
    setTopicMessage('')
    try {
      const res = await fetch('/api/admin/generate-topics', { method: 'POST' })
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      setTopicStatus(data.ok ? 'done' : 'error')
      setTopicMessage(data.message ?? data.error ?? '')
    } catch (err) {
      setTopicStatus('error')
      setTopicMessage(String(err))
    }
  }

  async function regenerateInsight() {
    setInsightStatus('running')
    try {
      const res = await fetch('/api/admin/regenerate-insight', { method: 'POST' })
      setInsightStatus(res.ok ? 'done' : 'error')
    } catch {
      setInsightStatus('error')
    }
  }

  return (
    <div className="space-y-5">
      {/* Batch candidate enrichment */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-[#0D1B2A] mb-1">
              Batch Candidate Enrichment
            </h3>
            <p className="text-xs text-[#0D1B2A]/60 leading-relaxed">
              Runs Grok enrichment on all {pendingCount} candidates that have manifesto
              text but no AI summary. May take several minutes — check Railway logs for
              progress on large batches.
            </p>
            {unenrichedSample.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-[#0D1B2A]/50 mb-1">
                  Pending (first 10):
                </p>
                <div className="flex flex-wrap gap-1">
                  {unenrichedSample.map(c => (
                    <span
                      key={c.id}
                      className="text-xs px-2 py-0.5 bg-gray-100
                                 text-[#0D1B2A]/70 rounded-full"
                    >
                      {c.name}
                    </span>
                  ))}
                  {pendingCount > 10 && (
                    <span className="text-xs text-[#0D1B2A]/40">
                      +{pendingCount - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={runBatchEnrich}
            disabled={batchStatus === 'running' || pendingCount === 0}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold
                       bg-[#A31621] text-[#F5E8C8] hover:bg-[#6B1414]
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {batchStatus === 'running'
              ? 'Enriching…'
              : pendingCount === 0
                ? 'All enriched ✓'
                : `Enrich ${pendingCount} candidates`}
          </button>
        </div>
        {batchMessage && (
          <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${
            batchStatus === 'done'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {batchMessage}
          </div>
        )}
      </div>

      {/* Topic summaries */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-[#0D1B2A] mb-1">
              Generate Topic Summaries
            </h3>
            <p className="text-xs text-[#0D1B2A]/60 leading-relaxed">
              Regenerates the policy topic summaries shown on the homepage.
              Currently: {topicsGenerated}/{topicTotal} generated.
              Run after batch enrichment completes.
            </p>
            {topicsGenerated === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ No summaries yet — homepage tiles show "No data yet"
              </p>
            )}
          </div>
          <button
            onClick={runGenerateTopics}
            disabled={topicStatus === 'running'}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold
                       bg-[#C8922A] text-[#0D1B2A] hover:bg-[#A87823]
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {topicStatus === 'running' ? 'Generating…' : 'Generate topics'}
          </button>
        </div>
        {topicMessage && (
          <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${
            topicStatus === 'done'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {topicMessage}
          </div>
        )}
      </div>

      {/* Pulse insight */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-[#0D1B2A] mb-1">
              Regenerate Pulse Insight
            </h3>
            <p className="text-xs text-[#0D1B2A]/60 leading-relaxed">
              Calls Grok to generate a new Public Pulse AI insight from current vote
              data. Normally runs every 6 hours via cron.
            </p>
          </div>
          <button
            onClick={regenerateInsight}
            disabled={insightStatus === 'running'}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold
                       bg-[#0D1B2A] text-[#F5E8C8] hover:bg-[#0D1B2A]/85
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {insightStatus === 'running'
              ? 'Generating…'
              : insightStatus === 'done'
                ? 'Done ✓'
                : 'Regenerate'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4
                      text-sm text-amber-800">
        <strong>April 27 pipeline:</strong> After the official candidate list
        publishes, run in order:
        <code className="ml-2 text-xs bg-amber-100 px-1.5 py-0.5 rounded">
          scrape:manifestos → enrich:batch → generate:topics
        </code>
      </div>
    </div>
  )
}
