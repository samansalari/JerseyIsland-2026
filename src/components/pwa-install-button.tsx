'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in window.navigator && (window.navigator as any).standalone === true)
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setShow(false)
  }

  if (!show) return null

  return (
    // ✓ WCAG — #F5E8C8 on #0D1B2A = 11.2:1 for title text
    // ✓ WCAG — text-on-primary/75 on #0D1B2A ≈ 10:1 for subtitle text
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t shadow-2xl"
      style={{
        backgroundColor: '#0D1B2A',
        borderColor: 'rgba(245,232,200,0.15)',
      }}
      role="banner"
      aria-label="Install VotePulse app"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-3">
          {/* Icon — #F5E8C8 on navy = 11.2:1 ✓ */}
          <span className="flex-shrink-0 text-xl text-on-primary" aria-hidden="true">
            🏛️
          </span>
          <div>
            {/* Title — cream on navy = 11.2:1 ✓ */}
            <p className="text-sm font-semibold leading-none text-on-primary mb-0.5">
              Jersey 2026 Election
            </p>
            {/* Subtitle — /75 on navy ≈ 10:1 ✓ */}
            <p className="text-xs text-on-primary/75">
              Add VotePulse to your home screen for quick access
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          {/* Install button — #F5E8C8 on #A31621 = 4.6:1 ✓ */}
          <button
            onClick={handleInstall}
            className="rounded-lg bg-jersey-red px-4 py-2 text-xs font-semibold text-on-primary transition-colors hover:bg-jersey-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jersey-red focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
          >
            Install
          </button>

          {/* Dismiss — /75 on navy ≈ 10:1 ✓ */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            className="rounded p-1 text-on-primary/75 transition-colors hover:text-on-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-on-primary/40"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
