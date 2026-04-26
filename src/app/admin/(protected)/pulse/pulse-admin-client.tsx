'use client'

import { useState } from 'react'

export function PulseAdminClient({ hasData }: { hasData: boolean }) {
  const [clearing, setClearing] = useState(false)
  const [clearDone, setClearDone] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenDone, setRegenDone] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  async function handleClear() {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setClearing(true)
    try {
      await fetch('/api/admin/clear-pulse', { method: 'POST' })
      setClearDone(true)
      setConfirmClear(false)
      setTimeout(() => window.location.reload(), 1500)
    } finally {
      setClearing(false)
    }
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      await fetch('/api/admin/regenerate-insight', { method: 'POST' })
      setRegenDone(true)
      setTimeout(() => window.location.reload(), 1500)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-[#0D1B2A] mb-1">
              Regenerate Pulse Insight
            </h3>
            <p className="text-xs text-[#0D1B2A]/60">
              Calls Grok to write a new AI insight from current vote/rating data.
              Normally runs automatically every 6 hours.
            </p>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating || regenDone}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold
                       bg-[#C8922A] text-[#0D1B2A] hover:bg-[#A87823]
                       disabled:opacity-40 transition-colors"
          >
            {regenDone ? 'Done ✓' : regenerating ? 'Generating…' : 'Regenerate'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-red-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-[#A31621] mb-1">
              Clear All Pulse Data
            </h3>
            <p className="text-xs text-[#0D1B2A]/60">
              Deletes all votes and ratings. Irreversible. Use only to reset test
              data before going live.
            </p>
          </div>
          <button
            onClick={handleClear}
            disabled={clearing || clearDone || !hasData}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold
                        transition-colors disabled:opacity-40 ${
                          confirmClear
                            ? 'bg-[#A31621] text-[#F5E8C8] hover:bg-[#6B1414]'
                            : 'bg-red-100 text-[#A31621] hover:bg-red-200 border border-red-200'
                        }`}
          >
            {clearDone
              ? 'Cleared ✓'
              : clearing
                ? 'Clearing…'
                : confirmClear
                  ? '⚠ Confirm — delete all?'
                  : hasData
                    ? 'Clear all data'
                    : 'No data to clear'}
          </button>
        </div>
        {confirmClear && !clearing && (
          <p className="text-xs text-[#A31621] mt-2">
            Click again to confirm. This permanently deletes all votes and ratings.
          </p>
        )}
      </div>
    </div>
  )
}
