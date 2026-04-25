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

  if (!show) return null

  return (
    <button
      onClick={handleInstall}
      title="Install VotePulse"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shadow-lg transition-opacity hover:opacity-90"
      style={{
        backgroundColor: '#0D1B2A',
        color: '#F5E8C8',
        border: '1px solid rgba(200,146,42,0.3)',
        fontFamily: 'Archivo, sans-serif',
      }}
      aria-label="Install VotePulse app"
    >
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
        stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Install
    </button>
  )
}
