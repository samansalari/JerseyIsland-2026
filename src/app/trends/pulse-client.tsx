'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────

const ISSUES = [
  { key: 'housing',        label: 'Housing',         icon: '🏠', color: '#A31621' },
  { key: 'healthcare',     label: 'Healthcare',       icon: '🏥', color: '#1A6B3A' },
  { key: 'cost_of_living', label: 'Cost of Living',  icon: '🛒', color: '#C8922A' },
  { key: 'environment',    label: 'Environment',      icon: '🌿', color: '#2D6A4F' },
  { key: 'economy',        label: 'Economy',          icon: '📈', color: '#0D1B2A' },
  { key: 'education',      label: 'Education',        icon: '📚', color: '#6B4C9A' },
  { key: 'transport',      label: 'Transport',        icon: '🚌', color: '#1565C0' },
  { key: 'tax',            label: 'Tax & Finance',    icon: '💰', color: '#E65100' },
  { key: 'public_services',label: 'Public Services',  icon: '🏛️', color: '#4A148C' },
  { key: 'immigration',    label: 'Immigration',      icon: '🌍', color: '#37474F' },
]

// ── StarRating ─────────────────────────────────────────────────────────────

function StarRating({
  candidateId,
  avgRating,
  totalRatings,
  onRate,
}: {
  candidateId: string
  avgRating: number
  totalRatings: number
  onRate: (id: string, rating: number) => void
}) {
  const [hovered, setHovered] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [localRating, setLocalRating] = useState(0)

  function handleRate(star: number) {
    if (submitted) return
    setSubmitted(true)
    setLocalRating(star)
    onRate(candidateId, star)
  }

  const displayRating = submitted ? localRating : hovered || avgRating

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => !submitted && setHovered(star)}
            onMouseLeave={() => !submitted && setHovered(0)}
            onClick={() => handleRate(star)}
            disabled={submitted}
            className="text-xl transition-transform hover:scale-110 disabled:cursor-default"
            style={{
              color:
                star <= displayRating ? '#C8922A' : 'rgba(13,27,42,0.15)',
            }}
          >
            ★
          </button>
        ))}
      </div>
      <div
        className="text-xs"
        style={{ color: 'rgba(13,27,42,0.4)', fontFamily: 'Archivo, sans-serif' }}
      >
        {totalRatings > 0
          ? `${avgRating.toFixed(1)} · ${totalRatings} rating${totalRatings !== 1 ? 's' : ''}`
          : 'No ratings yet'}
        {submitted && (
          <span className="ml-1 text-green-600">✓ Rated</span>
        )}
      </div>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Candidate {
  id: string
  name: string
  slug: string
  district: string
  party: string | null
}

interface PulseResults {
  issueResults: Array<{ issue: string; count: number }>
  totalVotes: number
  topRated: Array<{
    candidateId: string
    name: string
    slug: string
    district: string
    party: string | null
    avgRating: number
    totalRatings: number
  }>
}

type NewsSource = { headline: string; url: string; source: string }

// ── Main Component ─────────────────────────────────────────────────────────

export function PublicPulseClient({ candidates }: { candidates: Candidate[] }) {
  const [results, setResults] = useState<PulseResults | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [insight, setInsight] = useState<string | null>(null)
  const [insightSources, setInsightSources] = useState<NewsSource[]>([])
  const [insightLoading, setInsightLoading] = useState(false)
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState<'poll' | 'ratings'>('poll')

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch('/api/pulse/results')
      const data = await res.json() as PulseResults
      setResults(data)
    } catch {
      // non-fatal
    }
  }, [])

  const fetchInsight = useCallback(async () => {
    setInsightLoading(true)
    try {
      const res = await fetch('/api/pulse/insight', { cache: 'no-store' })
      const data = (await res.json()) as {
        insight: string | null
        sources?: NewsSource[]
      }
      setInsight(data.insight)
      setInsightSources(data.sources ?? [])
    } catch {
      // non-fatal
    } finally {
      setInsightLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetch('/api/pulse/vote', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ hasVoted?: boolean }>)
      .then((data) => {
        if (data.hasVoted) setHasVoted(true)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    void fetchResults()
    void fetchInsight()
    const interval = setInterval(() => {
      void fetchResults()
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchResults, fetchInsight])

  async function handleVote() {
    if (!selectedIssue) return
    setVoteError(null)
    try {
      const res = await fetch('/api/pulse/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue: selectedIssue }),
      })
      const data = (await res.json()) as {
        error?: string
        alreadyVoted?: boolean
      }
      if (res.status === 409 && data.alreadyVoted) {
        setHasVoted(true)
        void fetchResults()
        return
      }
      if (!res.ok) {
        setVoteError('Something went wrong. Please try again.')
        return
      }
      setHasVoted(true)
      void fetchResults()
    } catch {
      setVoteError('Something went wrong. Please try again.')
    }
  }

  async function handleRate(candidateId: string, rating: number) {
    setLocalRatings((prev) => ({ ...prev, [candidateId]: rating }))
    try {
      await fetch('/api/pulse/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, rating }),
      })
      void fetchResults()
    } catch {
      // non-fatal
    }
  }

  // Build sorted chart data
  const chartData = ISSUES.map((issue) => {
    const found = results?.issueResults.find((r) => r.issue === issue.key)
    const count = found?.count ?? 0
    const pct =
      results?.totalVotes && results.totalVotes > 0
        ? Math.round((count / results.totalVotes) * 100)
        : 0
    return { ...issue, count, pct }
  }).sort((a, b) => b.count - a.count)

  const filteredCandidates = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.district?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()),
  )

  return (
    <div
      className="mx-auto max-w-5xl px-4 py-10"
      style={{ fontFamily: 'Archivo, sans-serif' }}
    >
      {/* ── PAGE HEADER ─────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest"
            style={{ backgroundColor: 'rgba(163,22,33,0.1)', color: '#A31621' }}
          >
            Live
          </span>
        </div>
        <h1 className="mb-2 text-4xl font-bold" style={{ color: '#0D1B2A' }}>
          Public Pulse
        </h1>
        <p style={{ color: 'rgba(13,27,42,0.55)', fontSize: '1rem' }}>
          What matters most to Jersey voters? Share your view — anonymous, non-binding.
        </p>
      </div>

      {/* ── SECTION TABS ────────────────────────────────────────── */}
      <div
        className="mb-8 flex w-fit gap-1 rounded-xl p-1"
        style={{ backgroundColor: 'rgba(13,27,42,0.06)' }}
      >
        {(['poll', 'ratings'] as const).map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className="rounded-lg px-5 py-2 text-sm font-semibold capitalize transition-all"
            style={{
              backgroundColor: activeSection === section ? '#0D1B2A' : 'transparent',
              color: activeSection === section ? '#F5E8C8' : 'rgba(13,27,42,0.5)',
            }}
          >
            {section === 'poll' ? '🗳️ Issue Poll' : '⭐ Rate Candidates'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION 1: ISSUE POLL                                    */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeSection === 'poll' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* LEFT: Voting form */}
          <div
            className="rounded-2xl p-6"
            style={{
              backgroundColor: '#fff',
              border: '1px solid rgba(13,27,42,0.1)',
              boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
            }}
          >
            <h2 className="mb-1 text-lg font-bold" style={{ color: '#0D1B2A' }}>
              What matters most to you?
            </h2>
            <p className="mb-5 text-sm" style={{ color: 'rgba(13,27,42,0.5)' }}>
              Pick the issue you care about most for Jersey 2026.
            </p>

            {!hasVoted ? (
              <>
                <div className="mb-6 space-y-2">
                  {ISSUES.map((issue) => (
                    <button
                      key={issue.key}
                      onClick={() => setSelectedIssue(issue.key)}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all"
                      style={{
                        border:
                          selectedIssue === issue.key
                            ? `2px solid ${issue.color}`
                            : '2px solid rgba(13,27,42,0.08)',
                        backgroundColor:
                          selectedIssue === issue.key
                            ? `${issue.color}18`
                            : '#FAFAF8',
                        color:
                          selectedIssue === issue.key ? issue.color : '#0D1B2A',
                      }}
                    >
                      <span className="flex-shrink-0 text-lg">{issue.icon}</span>
                      <span>{issue.label}</span>
                      {selectedIssue === issue.key && (
                        <span className="ml-auto">✓</span>
                      )}
                    </button>
                  ))}
                </div>

                {voteError && (
                  <p
                    className="mb-3 rounded-lg p-2 text-center text-sm"
                    style={{
                      color: '#A31621',
                      backgroundColor: 'rgba(163,22,33,0.06)',
                    }}
                  >
                    {voteError}
                  </p>
                )}

                <button
                  onClick={() => void handleVote()}
                  disabled={!selectedIssue}
                  className="w-full rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: '#A31621', color: '#F5E8C8' }}
                >
                  Share My View →
                </button>

                <p
                  className="mt-3 text-center text-xs"
                  style={{ color: 'rgba(13,27,42,0.35)' }}
                >
                  Anonymous · Non-binding · One response per browser
                </p>
              </>
            ) : (
              <div
                className="rounded-2xl p-6 text-center"
                style={{
                  backgroundColor: 'rgba(26,107,58,0.06)',
                  border: '1px solid rgba(26,107,58,0.2)',
                }}
              >
                <div className="mb-2 text-2xl">✓</div>
                <p className="text-sm font-medium" style={{ color: '#1A6B3A' }}>
                  Your voice has been counted
                </p>
                <p
                  className="mt-1 text-xs"
                  style={{ color: 'rgba(13,27,42,0.4)' }}
                >
                  Results update automatically
                </p>
              </div>
            )}
          </div>

          {/* RIGHT: Live results */}
          <div
            className="rounded-2xl p-6"
            style={{
              backgroundColor: '#fff',
              border: '1px solid rgba(13,27,42,0.1)',
              boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
            }}
          >
            <div className="mb-5">
              <h3
                className="font-semibold"
                style={{ color: '#0D1B2A' }}
              >
                Live Results
              </h3>
            </div>

            {!results || results.totalVotes === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3">
                <span className="text-4xl opacity-20">📊</span>
                <p className="text-sm" style={{ color: 'rgba(13,27,42,0.4)' }}>
                  Be the first to vote — results appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {chartData
                  .filter((d) => d.count > 0)
                  .map((issue) => (
                    <div key={issue.key}>
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className="flex items-center gap-1.5 text-xs font-medium"
                          style={{ color: '#0D1B2A' }}
                        >
                          {issue.icon} {issue.label}
                        </span>
                        <span
                          className="text-xs font-bold"
                          style={{ color: issue.color }}
                        >
                          {issue.pct}%
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full"
                        style={{ backgroundColor: 'rgba(13,27,42,0.06)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${issue.pct}%`,
                            backgroundColor: issue.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Pulse analysis (from DB; generated on schedule) */}
            {(insight !== null || insightLoading) && (
              <div
                className="mt-6 rounded-xl p-4"
                style={{
                  backgroundColor: 'rgba(200,146,42,0.06)',
                  border: '1px solid rgba(200,146,42,0.2)',
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: '#C8922A' }}
                  >
                    ⚡ Analysis
                  </span>
                </div>
                {insightLoading ? (
                  <div
                    className="h-12 animate-pulse rounded-lg"
                    style={{ backgroundColor: 'rgba(200,146,42,0.1)' }}
                  />
                ) : (
                  <>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: '#0D1B2A' }}
                    >
                      {insight}
                    </p>
                    {insightSources.length > 0 && (
                      <div
                        className="mt-2 pt-2"
                        style={{ borderTop: '1px solid rgba(200,146,42,0.15)' }}
                      >
                        {insightSources.map((s, i) => (
                          <a
                            key={i}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs hover:underline"
                            style={{ color: 'rgba(13,27,42,0.4)' }}
                          >
                            Source: {s.source} — {s.headline.slice(0, 60)}…
                          </a>
                        ))}
                      </div>
                    )}
                    <p
                      className="mt-2 text-xs"
                      style={{ color: 'rgba(13,27,42,0.3)' }}
                    >
                      For reference only — check official and primary sources
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION 2: CANDIDATE RATINGS                             */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeSection === 'ratings' && (
        <div>
          {/* Top rated leaderboard */}
          {results && results.topRated.length > 0 && (
            <div
              className="mb-8 rounded-2xl p-6"
              style={{
                background: 'linear-gradient(135deg, #0D1B2A 0%, #1a2f47 100%)',
                border: '1px solid rgba(200,146,42,0.3)',
              }}
            >
              <h2 className="mb-1 text-lg font-bold" style={{ color: '#F5E8C8' }}>
                🏆 Top Rated Candidates
              </h2>
              <p
                className="mb-5 text-xs"
                style={{ color: 'rgba(245,232,200,0.5)' }}
              >
                Community ratings · minimum 3 ratings to appear
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {results.topRated.slice(0, 6).map((c, i) => (
                  <a
                    key={c.candidateId}
                    href={`/candidates/${c.slug}`}
                    className="flex items-center gap-3 rounded-xl p-3 transition-all hover:scale-105"
                    style={{
                      backgroundColor: 'rgba(245,232,200,0.06)',
                      border: '1px solid rgba(245,232,200,0.1)',
                      textDecoration: 'none',
                    }}
                  >
                    <span
                      className="w-8 flex-shrink-0 text-center text-lg font-black"
                      style={{
                        color: i === 0 ? '#C8922A' : 'rgba(245,232,200,0.3)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: '#F5E8C8' }}
                      >
                        {c.name}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: 'rgba(245,232,200,0.5)' }}
                      >
                        {c.district}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p
                        className="text-sm font-bold"
                        style={{ color: '#C8922A' }}
                      >
                        {Number(c.avgRating).toFixed(1)} ★
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: 'rgba(245,232,200,0.4)' }}
                      >
                        {c.totalRatings} ratings
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Search + rate all candidates */}
          <div
            className="rounded-2xl p-6"
            style={{
              backgroundColor: '#fff',
              border: '1px solid rgba(13,27,42,0.1)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#0D1B2A' }}>
                Rate a Candidate
              </h2>
              <span className="text-xs" style={{ color: 'rgba(13,27,42,0.4)' }}>
                One rating per candidate per day · anonymous
              </span>
            </div>

            <div className="relative mb-4">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: 'rgba(13,27,42,0.3)' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search candidates by name or district…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl py-2.5 pl-9 pr-4 text-sm"
                style={{
                  border: '1px solid rgba(13,27,42,0.12)',
                  fontFamily: 'Archivo, sans-serif',
                  outline: 'none',
                  color: '#0D1B2A',
                  backgroundColor: '#FAFAF8',
                }}
              />
            </div>

            <div className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto">
              {filteredCandidates.slice(0, 50).map((candidate) => {
                const existing = results?.topRated.find(
                  (r) => r.candidateId === candidate.id,
                )
                const avgRating = existing ? Number(existing.avgRating) : 0
                const totalRatings = existing?.totalRatings ?? 0

                return (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: '#A31621', color: '#F5E8C8' }}
                      >
                        {candidate.name
                          .split(' ')
                          .map((n) => n[0] ?? '')
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <a
                          href={`/candidates/${candidate.slug}`}
                          className="block truncate text-sm font-semibold hover:underline"
                          style={{ color: '#0D1B2A', textDecoration: 'none' }}
                        >
                          {candidate.name}
                        </a>
                        <p
                          className="text-xs"
                          style={{ color: 'rgba(13,27,42,0.4)' }}
                        >
                          {candidate.district}
                          {candidate.party && ` · ${candidate.party}`}
                        </p>
                      </div>
                    </div>

                    <StarRating
                      candidateId={candidate.id}
                      avgRating={localRatings[candidate.id] ?? avgRating}
                      totalRatings={totalRatings}
                      onRate={handleRate}
                    />
                  </div>
                )
              })}

              {filteredCandidates.length === 0 && (
                <p
                  className="py-8 text-center text-sm"
                  style={{ color: 'rgba(13,27,42,0.4)' }}
                >
                  No candidates found matching &ldquo;{searchQuery}&rdquo;
                </p>
              )}
            </div>
          </div>

          <p
            className="mt-4 text-center text-xs"
            style={{ color: 'rgba(13,27,42,0.3)' }}
          >
            ⚠ Community ratings are public opinion only · Not affiliated with any
            official body · VotePulse is independent and non-partisan
          </p>
        </div>
      )}
    </div>
  )
}
