'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { reEnrichCandidate } from './actions'

type Row = {
  id: string
  name: string
  slug: string
  district: string
  party: string | null
  hasManifesto: boolean
  hasSummary: boolean
  issueCount: number
  lastEnrichedAt: Date | null
  updatedAt: Date | null
}

export function CandidatesTable({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'enriched' | 'missing'>('all')
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = rows.filter(r => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.district.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ? true :
      filter === 'enriched' ? r.hasSummary :
      !r.hasSummary
    return matchSearch && matchFilter
  })

  function handleReEnrich(id: string, name: string) {
    setEnrichingId(id)
    setMessage(null)
    startTransition(async () => {
      const result = await reEnrichCandidate(id)
      setEnrichingId(null)
      setMessage(result.ok
        ? `✓ ${name} enriched successfully`
        : `✗ Error: ${result.error}`)
      setTimeout(() => setMessage(null), 5000)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <input
          type="search"
          placeholder="Search by name or district…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg
                     focus:outline-none focus:border-[#A31621]/40"
        />
        <div className="flex gap-1">
          {(['all', 'enriched', 'missing'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filter === f
                  ? 'bg-[#0D1B2A] text-[#F5E8C8]'
                  : 'bg-gray-100 text-[#0D1B2A]/60 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'enriched' ? 'Enriched' : 'Not enriched'}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#0D1B2A]/40">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {message && (
        <div className={`mx-4 mt-3 px-4 py-2 rounded-lg text-sm ${
          message.startsWith('✓')
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-[#0D1B2A]/50
                           uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">District</th>
              <th className="px-4 py-3 text-left font-semibold">Party</th>
              <th className="px-4 py-3 text-center font-semibold">Manifesto</th>
              <th className="px-4 py-3 text-center font-semibold">Summary</th>
              <th className="px-4 py-3 text-center font-semibold">Issues</th>
              <th className="px-4 py-3 text-left font-semibold">Last enriched</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-gray-50 hover:bg-gray-50/50
                            transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-[#0D1B2A]">{row.name}</div>
                  <div className="text-xs text-[#0D1B2A]/40">{row.slug}</div>
                </td>
                <td className="px-4 py-3 text-[#0D1B2A]/70">{row.district}</td>
                <td className="px-4 py-3">
                  {row.party ? (
                    <span className="px-2 py-0.5 bg-[#0D1B2A]/10 text-[#0D1B2A]
                                     text-xs rounded-full">
                      {row.party}
                    </span>
                  ) : (
                    <span className="text-[#0D1B2A]/40 text-xs">Independent</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.hasManifesto
                    ? <span className="text-[#1A6B3A]">✓</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.hasSummary
                    ? <span className="text-[#1A6B3A]">✓</span>
                    : <span className="text-[#A31621]">✗</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {Number(row.issueCount) > 0 ? (
                    <span className="px-2 py-0.5 bg-[#1A6B3A]/10 text-[#1A6B3A]
                                     text-xs font-semibold rounded-full">
                      {row.issueCount}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#0D1B2A]/50">
                  {row.lastEnrichedAt
                    ? new Date(row.lastEnrichedAt).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/candidates/${row.slug}`}
                      target="_blank"
                      className="text-xs text-[#A31621] hover:underline"
                    >
                      View ↗
                    </Link>
                    <button
                      onClick={() => handleReEnrich(row.id, row.name)}
                      disabled={enrichingId === row.id || isPending}
                      className="text-xs px-2 py-1 rounded-lg bg-[#0D1B2A]/5
                                 hover:bg-[#0D1B2A]/10 text-[#0D1B2A]/70
                                 disabled:opacity-40 disabled:cursor-not-allowed
                                 transition-colors font-medium"
                    >
                      {enrichingId === row.id ? 'Enriching…' : 'Re-enrich'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[#0D1B2A]/40">
            No candidates match your search.
          </div>
        )}
      </div>
    </div>
  )
}
