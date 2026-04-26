'use client'

import { useState } from 'react'

type ScraperConfig = {
  /** Must match the scraperName enum in /api/admin/run-scraper */
  id: 'flow_je' | 'vote_je' | 'policy_je' | 'ingest_news' | 'enrich_articles'
  label: string
  description: string
  warning?: string
  colour: string
}

const SCRAPERS: ScraperConfig[] = [
  {
    id: 'flow_je',
    label: 'Scrape flow.je',
    description: 'Live scrape of flow.je/elections/2026 candidate pages.',
    warning: 'Uses Firecrawl credits',
    colour: '#C8922A',
  },
  {
    id: 'vote_je',
    label: 'Scrape vote.je Profiles',
    description: 'Batch profile scrape from vote.je.',
    warning: 'Uses Firecrawl credits',
    colour: '#C8922A',
  },
  {
    id: 'policy_je',
    label: 'Scrape policy.je Manifestos',
    description: 'Scrapes 2026 manifesto URLs. Updates manifesto_raw when longer.',
    warning: 'Uses Firecrawl credits',
    colour: '#C8922A',
  },
  {
    id: 'ingest_news',
    label: 'Ingest News (RSS)',
    description: 'Polls configured RSS feeds for new election articles.',
    colour: '#0D1B2A',
  },
  {
    id: 'enrich_articles',
    label: 'Enrich Articles (AI)',
    description: 'Runs AI sentiment + summary on newly ingested news articles.',
    colour: '#0D1B2A',
  },
]

type RunResult = {
  ok: boolean
  durationSec?: number
  outputTail?: string
  error?: string
}

export function ScrapersClient() {
  const [running, setRunning] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, RunResult>>({})

  async function runScraper(id: string) {
    setRunning(id)
    setResults(prev => ({ ...prev, [id]: { ok: false } }))

    try {
      const res = await fetch('/api/admin/run-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scraperName: id }),
      })
      const data = (await res.json()) as RunResult
      setResults(prev => ({ ...prev, [id]: data }))
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [id]: { ok: false, error: String(err) },
      }))
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="space-y-4">
      {SCRAPERS.map(scraper => {
        const result = results[scraper.id]
        const isRunning = running === scraper.id

        return (
          <div key={scraper.id}
            className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-[#0D1B2A] text-sm">
                    {scraper.label}
                  </h3>
                  {scraper.warning && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700
                                     rounded-full border border-amber-200">
                      ⚠ {scraper.warning}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#0D1B2A]/60 leading-relaxed">
                  {scraper.description}
                </p>
              </div>

              <button
                onClick={() => runScraper(scraper.id)}
                disabled={!!running}
                className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold
                           transition-all disabled:opacity-40 disabled:cursor-not-allowed
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-[#A31621]"
                style={{
                  backgroundColor: isRunning ? '#6B7280' : scraper.colour,
                  color: '#F5E8C8',
                }}
              >
                {isRunning ? 'Running…' : 'Run now'}
              </button>
            </div>

            {result && (
              <div className="mt-4">
                <div className={`text-xs font-semibold mb-2 ${
                  result.ok ? 'text-[#1A6B3A]' : 'text-[#A31621]'
                }`}>
                  {result.ok
                    ? `✓ Completed${result.durationSec != null ? ` in ${result.durationSec.toFixed(1)}s` : ''}`
                    : `✗ Failed${result.error ? `: ${result.error}` : ''}`}
                </div>
                {result.outputTail && (
                  <pre className="text-xs bg-gray-950 text-green-400 rounded-lg
                                  p-3 overflow-x-auto max-h-48 overflow-y-auto
                                  font-mono leading-relaxed whitespace-pre-wrap">
                    {result.outputTail}
                  </pre>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm
                      text-amber-800">
        <strong>Note:</strong> Scripts run on the web server with a 10-minute timeout.
        For batch enrichment (135 candidates × ~15 s each), trigger the Railway
        worker directly:{' '}
        <a href="https://railway.app" target="_blank" rel="noopener noreferrer"
          className="underline font-semibold">
          railway.app ↗
        </a>
      </div>
    </div>
  )
}
