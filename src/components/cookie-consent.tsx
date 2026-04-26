'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const CONSENT_KEY = 'vp_consent'
const CONSENT_DURATION_DAYS = 365

function setConsentCookie(value: 'accepted' | 'declined') {
  const expires = new Date()
  expires.setDate(expires.getDate() + CONSENT_DURATION_DAYS)
  document.cookie = `${CONSENT_KEY}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

function getConsentCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${CONSENT_KEY}=`))
  return match ? match.split('=')[1] ?? null : null
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const existing = getConsentCookie()
    if (!existing) {
      const timer = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  function handleAccept() {
    setConsentCookie('accepted')
    setVisible(false)
    window.dispatchEvent(new CustomEvent('vp:consent:accepted'))
  }

  function handleDecline() {
    setConsentCookie('declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 bg-[#0D1B2A] border-t border-white/10 shadow-2xl"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#F5E8C8]/90 leading-relaxed">
            <strong className="text-[#F5E8C8]">This site uses analytics cookies.</strong>{' '}
            We use Google Analytics and Microsoft Clarity to understand how visitors use
            VotePulse. No personal data is sold or shared beyond these services.{' '}
            <Link
              href="/privacy"
              className="text-[#C8922A] underline underline-offset-2 hover:text-[#F5E8C8] transition-colors"
            >
              Privacy policy
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/20
                       text-[#F5E8C8]/70 hover:border-white/40 hover:text-[#F5E8C8]
                       transition-colors focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#C8922A] text-[#0D1B2A]
                       hover:bg-[#A87823] transition-colors focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-[#C8922A]
                       focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1B2A]"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  )
}
