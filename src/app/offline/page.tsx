'use client'

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ backgroundColor: '#0D1B2A', fontFamily: 'Archivo, sans-serif' }}
    >
      <div className="text-5xl mb-6">📡</div>
      <h1
        className="text-2xl font-bold mb-3"
        style={{ color: '#F5E8C8' }}
      >
        You&apos;re offline
      </h1>
      <p
        className="text-sm max-w-xs leading-relaxed mb-8"
        style={{ color: 'rgba(245, 232, 200, 0.6)' }}
      >
        VotePulse needs a connection to load the latest candidate data.
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-xl font-semibold text-sm"
        style={{ backgroundColor: '#A31621', color: '#F5E8C8' }}
      >
        Try again
      </button>
    </div>
  )
}
