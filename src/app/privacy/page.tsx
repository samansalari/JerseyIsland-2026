import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | VotePulse',
  description:
    'How VotePulse collects, uses and protects personal data. ' +
    'Cookie policy and your rights under the Data Protection (Jersey) Law 2018.',
  robots: { index: true, follow: true },
}

const LAST_UPDATED = '27 April 2026'
const CONTROLLER_EMAIL = 'hello@votepulse.je'
const JOIC_URL = 'https://jerseyoic.org'

export default function PrivacyPage() {
  return (
    <main className="bg-[#F5F5F0] min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#C8922A]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
              Legal
            </span>
          </div>
          <h1 className="text-3xl font-bold text-[#0D1B2A] tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#0D1B2A]/60">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 text-[#0D1B2A]">

          {/* 1. Who we are */}
          <section>
            <h2 className="text-lg font-bold mb-3">1. Who we are</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-[#0D1B2A]/75 leading-relaxed space-y-3">
              <p>
                VotePulse (<strong>votepulse.je</strong>) is an independent, non-partisan
                election intelligence platform for Jersey&rsquo;s 2026 general election.
                It is operated by <strong>Seenovate Ltd</strong>, a company registered in Jersey.
              </p>
              <p>
                <strong>Data controller:</strong> Seenovate Ltd<br />
                <strong>Contact:</strong>{' '}
                <a href={`mailto:${CONTROLLER_EMAIL}`} className="text-[#A31621] hover:underline">
                  {CONTROLLER_EMAIL}
                </a>
              </p>
            </div>
          </section>

          {/* 2. What data we collect */}
          <section>
            <h2 className="text-lg font-bold mb-3">2. What data we collect</h2>
            <div className="space-y-4">

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-[#0D1B2A] mb-2">
                  Analytics (only with your consent)
                </h3>
                <div className="text-sm text-[#0D1B2A]/70 leading-relaxed space-y-2">
                  <p>
                    If you accept analytics cookies, we use{' '}
                    <strong>Google Analytics 4</strong> and{' '}
                    <strong>Microsoft Clarity</strong> to understand how visitors use VotePulse.
                  </p>
                  <p>These services may collect:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Anonymised IP address (last octet removed)</li>
                    <li>Pages visited and time spent</li>
                    <li>Browser type and device information</li>
                    <li>Referring website</li>
                    <li>
                      Microsoft Clarity additionally records session replays and heatmaps
                      (no passwords or sensitive form data)
                    </li>
                  </ul>
                  <p className="text-xs text-[#0D1B2A]/50 mt-2">
                    Data is processed by Google LLC and Microsoft Corporation under their
                    respective privacy policies. IP anonymisation is enabled for Google Analytics.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-[#0D1B2A] mb-2">
                  Public Pulse voting cookie
                </h3>
                <div className="text-sm text-[#0D1B2A]/70 leading-relaxed space-y-2">
                  <p>
                    When you vote on the Public Pulse page, we set a cookie named{' '}
                    <code className="bg-gray-100 px-1 rounded">vp_voted</code> in your browser.
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Purpose:</strong> To prevent duplicate votes (one vote per person per 24 hours)</li>
                    <li><strong>Duration:</strong> 24 hours</li>
                    <li><strong>Data stored:</strong> A fingerprint hash only — no name, email or identifiable information</li>
                  </ul>
                  <p>
                    This cookie is technically necessary to prevent abuse of the voting system.
                    It does not track you across websites.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-[#0D1B2A] mb-2">
                  Cookie consent preference
                </h3>
                <div className="text-sm text-[#0D1B2A]/70 leading-relaxed">
                  <p>
                    We store your analytics cookie preference in a cookie named{' '}
                    <code className="bg-gray-100 px-1 rounded">vp_consent</code>.
                    This records whether you accepted or declined analytics. It expires after 365 days.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-[#0D1B2A] mb-2">Candidate data</h3>
                <div className="text-sm text-[#0D1B2A]/70 leading-relaxed space-y-2">
                  <p>
                    VotePulse collects and processes publicly available information about Jersey
                    election candidates, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Names, districts, party affiliations</li>
                    <li>Manifesto text — collected from public sources (flow.je, vote.je, candidate websites)</li>
                    <li>AI-generated summaries derived from manifesto text</li>
                    <li>Social media profile URLs (publicly listed)</li>
                  </ul>
                  <p>
                    <strong>Lawful basis:</strong> Legitimate interest — providing the public with
                    neutral, factual election information in the public interest.
                  </p>
                  <p>
                    <strong>Candidates&rsquo; right of correction or removal:</strong>{' '}
                    Any candidate who believes information about them is inaccurate or wishes to have
                    information removed may contact us at{' '}
                    <a href={`mailto:${CONTROLLER_EMAIL}`} className="text-[#A31621] hover:underline">
                      {CONTROLLER_EMAIL}
                    </a>
                    . We will respond within 4 weeks as required by law.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-[#0D1B2A] mb-2">What we do NOT collect</h3>
                <div className="text-sm text-[#0D1B2A]/70 leading-relaxed">
                  <ul className="list-disc list-inside space-y-1">
                    <li>No user accounts or registration</li>
                    <li>No names, email addresses, or contact details from visitors</li>
                    <li>No payment information</li>
                    <li>No location data beyond country-level (from analytics, if consented)</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Cookies table */}
          <section>
            <h2 className="text-lg font-bold mb-3">3. Cookies we use</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Cookie name', 'Purpose', 'Duration', 'Required?'].map(h => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-semibold text-[#0D1B2A]/60 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[#0D1B2A]/70">
                    {[
                      {
                        name: 'vp_consent',
                        purpose: 'Stores your analytics cookie preference',
                        duration: '1 year',
                        required: 'Functional',
                      },
                      {
                        name: 'vp_voted',
                        purpose: 'Prevents duplicate votes on Public Pulse',
                        duration: '24 hours',
                        required: 'Functional',
                      },
                      {
                        name: 'sb-* (Supabase)',
                        purpose: 'Admin session — only set if you log into /admin',
                        duration: 'Session',
                        required: 'Functional',
                      },
                      {
                        name: '_ga, _ga_*',
                        purpose: 'Google Analytics — page view tracking',
                        duration: '2 years',
                        required: 'Analytics (consent)',
                      },
                      {
                        name: '_clck, _clsk',
                        purpose: 'Microsoft Clarity — session recording',
                        duration: '1 year / session',
                        required: 'Analytics (consent)',
                      },
                    ].map(row => (
                      <tr key={row.name}>
                        <td className="px-4 py-3 font-mono">{row.name}</td>
                        <td className="px-4 py-3">{row.purpose}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.duration}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                              row.required === 'Functional'
                                ? 'bg-[#0D1B2A]/10 text-[#0D1B2A]'
                                : 'bg-[#C8922A]/15 text-[#C8922A]'
                            }`}
                          >
                            {row.required}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 4. Your rights */}
          <section>
            <h2 className="text-lg font-bold mb-3">4. Your rights under Jersey law</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-[#0D1B2A]/70 leading-relaxed space-y-3">
              <p>
                Under the <strong>Data Protection (Jersey) Law 2018</strong>, you have the
                following rights regarding personal data we hold about you:
              </p>
              <ul className="space-y-2">
                {[
                  ['Right of access', 'Request a copy of data held about you'],
                  ['Right to rectification', 'Request correction of inaccurate data'],
                  ['Right to erasure', 'Request deletion of your data'],
                  ['Right to object', 'Object to processing based on legitimate interest'],
                  ['Right to withdraw consent', 'Withdraw analytics consent at any time by clearing cookies'],
                ].map(([right, desc]) => (
                  <li key={right} className="flex gap-2">
                    <span className="text-[#1A6B3A] font-bold flex-shrink-0">✓</span>
                    <span>
                      <strong>{right}:</strong> {desc}
                    </span>
                  </li>
                ))}
              </ul>
              <p>
                To exercise any right, contact us at{' '}
                <a href={`mailto:${CONTROLLER_EMAIL}`} className="text-[#A31621] hover:underline">
                  {CONTROLLER_EMAIL}
                </a>
                . We will respond within 4 weeks.
              </p>
              <p>
                You may also lodge a complaint with the{' '}
                <a
                  href={JOIC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#A31621] hover:underline"
                >
                  Jersey Office of the Information Commissioner (JOIC) ↗
                </a>{' '}
                at jerseyoic.org or by calling 01534 716530.
              </p>
            </div>
          </section>

          {/* 5. Withdraw consent */}
          <section>
            <h2 className="text-lg font-bold mb-3">5. How to withdraw analytics consent</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-[#0D1B2A]/70 leading-relaxed space-y-2">
              <p>You can withdraw your analytics consent at any time by:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>
                  Clearing the{' '}
                  <code className="bg-gray-100 px-1 rounded">vp_consent</code> cookie from
                  your browser settings
                </li>
                <li>Reloading the page — the consent banner will reappear</li>
                <li>Clicking &ldquo;Decline&rdquo;</li>
              </ol>
              <p>
                Alternatively, use your browser&rsquo;s built-in settings to block all cookies
                from votepulse.je.
              </p>
            </div>
          </section>

          {/* 6. Third parties */}
          <section>
            <h2 className="text-lg font-bold mb-3">6. Third-party services</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-[#0D1B2A]/70 leading-relaxed space-y-2">
              <p>VotePulse uses the following third-party services:</p>
              <ul className="space-y-3">
                {[
                  {
                    name: 'Google Analytics 4',
                    purpose: 'Usage analytics (consent required)',
                    privacy: 'https://policies.google.com/privacy',
                  },
                  {
                    name: 'Microsoft Clarity',
                    purpose: 'Session recording and heatmaps (consent required)',
                    privacy: 'https://privacy.microsoft.com/privacystatement',
                  },
                  {
                    name: 'Supabase',
                    purpose: 'Admin authentication and database hosting',
                    privacy: 'https://supabase.com/privacy',
                  },
                  {
                    name: 'Railway',
                    purpose: 'Website hosting and infrastructure',
                    privacy: 'https://railway.app/legal/privacy',
                  },
                ].map(s => (
                  <li key={s.name} className="flex gap-2">
                    <span className="text-[#C8922A] font-bold flex-shrink-0">→</span>
                    <span>
                      <strong>{s.name}</strong> — {s.purpose}.{' '}
                      <a
                        href={s.privacy}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#A31621] hover:underline"
                      >
                        Privacy policy ↗
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 7. Changes */}
          <section>
            <h2 className="text-lg font-bold mb-3">7. Changes to this policy</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-[#0D1B2A]/70 leading-relaxed">
              <p>
                We may update this Privacy Policy from time to time. The date at the top of
                this page indicates when it was last updated. Continued use of VotePulse after
                changes constitutes acceptance of the updated policy.
              </p>
            </div>
          </section>

          {/* Contact CTA */}
          <div className="bg-[#0D1B2A] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#F5E8C8] mb-2">Questions about your data?</h2>
            <p className="text-sm text-[#F5E8C8]/70 mb-4">
              Contact us at{' '}
              <a
                href={`mailto:${CONTROLLER_EMAIL}`}
                className="text-[#C8922A] hover:underline font-semibold"
              >
                {CONTROLLER_EMAIL}
              </a>
              . We aim to respond within 5 working days.
            </p>
            <p className="text-xs text-[#F5E8C8]/40">
              Jersey Office of the Information Commissioner (JOIC): jerseyoic.org · 01534 716530
            </p>
          </div>

        </div>
      </div>
    </main>
  )
}
