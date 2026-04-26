import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use | VotePulse',
  description: 'Terms of use for VotePulse — Jersey 2026 election intelligence.',
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <main className="bg-[#F5F5F0] min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#C8922A]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
              Legal
            </span>
          </div>
          <h1 className="text-3xl font-bold text-[#0D1B2A] tracking-tight mb-3">
            Terms of Use
          </h1>
          <p className="text-sm text-[#0D1B2A]/60">Last updated: 27 April 2026</p>
        </div>

        <div className="space-y-4 text-sm text-[#0D1B2A]/75 leading-relaxed">
          {[
            {
              title: '1. Acceptance of terms',
              content:
                'By using VotePulse (votepulse.je), you agree to these Terms of Use. If you do not agree, please do not use the site. These terms may be updated from time to time — continued use constitutes acceptance.',
            },
            {
              title: '2. Purpose of the service',
              content:
                "VotePulse is a free, non-partisan public information service providing election intelligence for Jersey's 2026 general election. It is not affiliated with the States of Jersey, the Jersey Electoral Authority, or any political party or candidate.",
            },
            {
              title: '3. Accuracy of information',
              content:
                'VotePulse provides information in good faith from publicly available sources. AI-generated summaries may contain errors, omissions, or misrepresentations of candidate positions. You should always verify information against original manifesto sources before making voting decisions. VotePulse makes no warranty, express or implied, about the accuracy, completeness, or fitness for purpose of any content.',
            },
            {
              title: '4. No endorsement',
              content:
                'VotePulse does not endorse, recommend, oppose, or rank any election candidate or political party. Content is presented neutrally and alphabetically. Any perceived bias is unintentional and should be reported to hello@votepulse.je.',
            },
            {
              title: '5. Candidate data and corrections',
              content:
                'Information about candidates is derived from publicly available sources. Candidates who identify inaccuracies may request corrections by emailing hello@votepulse.je. VotePulse will review and respond within 4 weeks.',
            },
            {
              title: '6. Limitation of liability',
              content:
                'VotePulse and its operators shall not be liable for any loss, damage, or harm arising from use of or reliance on content published on this site. The site is provided "as is" without warranties of any kind. In no event shall VotePulse\'s liability exceed the amount paid by you to use the service (which is zero, as the service is free).',
            },
            {
              title: '7. Intellectual property',
              content:
                'The VotePulse platform code is open source under the MIT licence. Candidate manifesto text is reproduced under fair dealing for the purpose of public information. If you are a candidate and object to the use of your manifesto text, contact hello@votepulse.je.',
            },
            {
              title: '8. Governing law',
              content:
                'These terms are governed by the laws of Jersey, Channel Islands. Any disputes shall be subject to the exclusive jurisdiction of the courts of Jersey.',
            },
          ].map(section => (
            <div
              key={section.title}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <h2 className="font-bold text-[#0D1B2A] mb-2">{section.title}</h2>
              <p>{section.content}</p>
            </div>
          ))}

          <div className="bg-[#0D1B2A] rounded-xl p-5 text-center">
            <p className="text-[#F5E8C8]/70 text-xs mb-2">Questions about these terms?</p>
            <a
              href="mailto:hello@votepulse.je"
              className="text-[#C8922A] hover:underline font-semibold text-sm"
            >
              hello@votepulse.je
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
