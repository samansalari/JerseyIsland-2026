'use client'

import { buildSocialLinks } from '@/lib/social-links'

interface SocialLinksProps {
  rawLinks: Record<string, string> | null
  theme?: 'dark' | 'light'
}

export function SocialLinks({ rawLinks, theme = 'dark' }: SocialLinksProps) {
  if (!rawLinks || Object.keys(rawLinks).length === 0) return null

  const links = buildSocialLinks(rawLinks)
  if (links.length === 0) return null

  const isDark = theme === 'dark'

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.platform}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title={link.label}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:scale-105 hover:shadow-md"
          style={{
            border: isDark
              ? '1px solid rgba(245,232,200,0.15)'
              : '1px solid rgba(13,27,42,0.12)',
            color: isDark ? '#F5E8C8' : '#0D1B2A',
            backgroundColor: isDark
              ? 'rgba(245,232,200,0.07)'
              : 'rgba(13,27,42,0.04)',
            fontFamily: 'Archivo, sans-serif',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLAnchorElement
            el.style.borderColor = link.color
            el.style.color = link.color
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLAnchorElement
            el.style.borderColor = isDark
              ? 'rgba(245,232,200,0.15)'
              : 'rgba(13,27,42,0.12)'
            el.style.color = isDark ? '#F5E8C8' : '#0D1B2A'
          }}
        >
          <span
            dangerouslySetInnerHTML={{ __html: link.icon }}
            className="flex-shrink-0"
          />
          {link.label}
          <svg
            width="10"
            height="10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            className="opacity-50"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      ))}
    </div>
  )
}
