export interface SocialLink {
  platform: string
  label: string
  url: string
  icon: string
  color: string
}

const PLATFORM_CONFIG: Record<
  string,
  {
    label: string
    icon: string
    color: string
    buildUrl: (handle: string) => string | null
  }
> = {
  twitter: {
    label: 'X / Twitter',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    color: '#000000',
    buildUrl: (h) => {
      // Already a full URL (extractor normalises twitter.com → keep, redirect to x.com)
      if (h.startsWith('http')) {
        return h
          .replace('https://twitter.com/', 'https://x.com/')
          .replace('http://twitter.com/', 'https://x.com/')
      }
      const clean = h.replace(/^@/, '').trim()
      if (!clean || clean.includes(' ')) return null
      return `https://x.com/${clean}`
    },
  },
  // `x` key is also produced by the extractor for x.com URLs
  x: {
    label: 'X / Twitter',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    color: '#000000',
    buildUrl: (h) => {
      if (h.startsWith('http')) return h
      const clean = h.replace(/^@/, '').trim()
      if (!clean || clean.includes(' ')) return null
      return `https://x.com/${clean}`
    },
  },
  facebook: {
    label: 'Facebook',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    color: '#1877F2',
    buildUrl: (h) => {
      if (h.startsWith('http')) return h
      const clean = h.replace(/^@/, '').trim()
      if (!clean) return null
      return `https://www.facebook.com/${clean}`
    },
  },
  website: {
    label: 'Website',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    color: '#0D1B2A',
    buildUrl: (h) => {
      if (h.startsWith('http')) return h
      if (h.includes('.')) return `https://${h}`
      return null
    },
  },
  wikipedia: {
    label: 'Wikipedia',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.342.009 5.343.009L5.45 4.86h.033c.07.068.105.161.105.259 0 .296 0 .296-.165.37-.327.149-.484.432-.484.701 0 .167.055.468.165.921.614 2.46 3.516 9.062 3.516 9.062l2.082-4.016-1.765-4.134c-.52-1.565-.77-2.312-1.269-2.693-.241-.176-.59-.26-1.048-.271-.07 0-.091-.037-.091-.11V4.64l.041-.047c.523-.005 3.54-.009 4.199-.009l.057.004.046.042c.07.068.105.16.105.258 0 .3 0 .3-.165.373-.327.148-.484.432-.484.7 0 .151.054.443.165.877l1.26 4.267 1.76-3.716c.157-.358.243-.681.243-.917 0-.29-.07-.485-.207-.583-.137-.098-.38-.162-.729-.186-.07-.005-.091-.037-.091-.11V4.64l.041-.047c.456-.005 2.712-.009 3.231-.009l.057.004.046.042c.07.068.105.16.105.258 0 .3 0 .3-.165.373-.327.148-.484.432-.484.7 0 .167.055.468.165.921l3.516 9.062 2.082-4.016c.245-.473.38-.847.38-1.144 0-.37-.117-.63-.35-.783-.235-.151-.586-.245-1.052-.26-.07 0-.091-.037-.091-.11V4.64l.041-.047c.523-.005 3.541-.009 4.199-.009l.057.004.046.042c.07.068.105.16.105.258 0 .3 0 .3-.165.373-.317.148-.484.432-.484.7l.002.002c.614 2.46 3.516 9.062 3.516 9.062s-2.236-4.548-2.853-5.728l-.002-.004c-1.38 2.664-5.338 10.494-5.338 10.494-.616 1.074-1.127.931-1.532.029l-4.293-9.144z"/></svg>`,
    color: '#000000',
    buildUrl: (h) => {
      if (h.startsWith('http')) return h
      const encoded = encodeURIComponent(h.replace(/ /g, '_'))
      return `https://en.wikipedia.org/wiki/${encoded}`
    },
  },
  youtube: {
    label: 'YouTube',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    color: '#FF0000',
    buildUrl: (h) => {
      if (h.startsWith('http')) return h
      const clean = h.replace(/^@/, '')
      return `https://youtube.com/@${clean}`
    },
  },
  instagram: {
    label: 'Instagram',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`,
    color: '#E4405F',
    buildUrl: (h) => {
      if (h.startsWith('http')) return h
      const clean = h.replace(/^@/, '')
      return `https://instagram.com/${clean}`
    },
  },
  linkedin: {
    label: 'LinkedIn',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    color: '#0A66C2',
    buildUrl: (h) => {
      if (h.startsWith('http')) return h
      const clean = h.replace(/^@/, '').trim()
      if (!clean) return null
      return `https://linkedin.com/in/${clean}`
    },
  },
}

export function buildSocialLinks(
  rawLinks: Record<string, string>,
): SocialLink[] {
  const result: SocialLink[] = []
  // Track platforms already added (twitter and x are the same visual platform)
  const seen = new Set<string>()

  for (const [platform, handle] of Object.entries(rawLinks)) {
    const key = platform.toLowerCase()
    const config = PLATFORM_CONFIG[key]
    if (!config) continue

    // Deduplicate: treat twitter and x as the same slot
    const dedupeKey = key === 'x' ? 'twitter' : key
    if (seen.has(dedupeKey)) continue

    const url = config.buildUrl(handle)
    if (!url) continue

    try {
      new URL(url)
    } catch {
      continue
    }

    seen.add(dedupeKey)
    result.push({
      platform: dedupeKey,
      label: config.label,
      url,
      icon: config.icon,
      color: config.color,
    })
  }

  return result
}
