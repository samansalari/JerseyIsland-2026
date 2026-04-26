'use client'

import { useEffect } from 'react'

const GA_ID = 'G-4WZWNNE0LP'
const CLARITY_ID = 'whg4c7n340'

function hasConsent(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie
    .split('; ')
    .some(row => row === 'vp_consent=accepted')
}

function loadGA() {
  if (document.getElementById('vp-ga4')) return
  const script1 = document.createElement('script')
  script1.id = 'vp-ga4'
  script1.async = true
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script1)

  const script2 = document.createElement('script')
  script2.id = 'vp-ga4-config'
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}', { anonymize_ip: true });
  `
  document.head.appendChild(script2)
}

function loadClarity() {
  if (document.getElementById('vp-clarity')) return
  const script = document.createElement('script')
  script.id = 'vp-clarity'
  script.innerHTML = `
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${CLARITY_ID}");
  `
  document.head.appendChild(script)
}

export function Analytics() {
  useEffect(() => {
    if (hasConsent()) {
      loadGA()
      loadClarity()
      return
    }

    function onConsent() {
      loadGA()
      loadClarity()
    }

    window.addEventListener('vp:consent:accepted', onConsent)
    return () => window.removeEventListener('vp:consent:accepted', onConsent)
  }, [])

  return null
}
