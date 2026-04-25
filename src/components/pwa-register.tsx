'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[VotePulse PWA] Service worker registered:', reg.scope)
          })
          .catch((err) => {
            console.warn('[VotePulse PWA] Service worker failed:', err)
          })
      })
    }
  }, [])

  return null
}
