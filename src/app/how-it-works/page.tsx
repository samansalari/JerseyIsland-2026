import type { Metadata } from 'next'
import Link from 'next/link'

// ── SEO Metadata ──────────────────────────────────────────────────────────────

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://votepulse.je'

export const metadata: Metadata = {
  title: "How Jersey's 2026 Election Works | VotePulse",
  description:
    "Jersey's 2026 general election is on 7 June 2026. " +
    'Voters elect 49 States Members across three categories: ' +
    '9 senators (island-wide), 28 deputies (9 constituencies), ' +
    'and 12 parish connétables. Each voter has 12–14 votes. ' +
    "Turnout in 2022 was 41.7%. Here's everything you need to know.",
  keywords: [
    'how to vote Jersey 2026',
    'Jersey election 2026 explained',
    'Jersey States Assembly election',
    'who can vote Jersey',
    'Jersey election senator deputy connétable',
    'vote.je 2026',
  ],
  openGraph: {
    title: "How Jersey's 2026 Election Works",
    description:
      "Your complete guide to voting in Jersey's 7 June 2026 general " +
      'election. 49 seats, 3 categories, 12–14 votes per voter.',
    type: 'article',
  },
  alternates: {
    canonical: `${siteUrl}/how-it-works`,
  },
}

// ── Speakable + FAQ JSON-LD ───────────────────────────────────────────────────

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${siteUrl}/how-it-works`,
      name: "How Jersey's 2026 Election Works",
      description:
        "A complete guide to Jersey's 2026 general election — " +
        'who can vote, how the three-category system works, ' +
        'and what happens on 7 June 2026.',
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['#how-it-works-lead', '#aeo-how-it-works'],
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: siteUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'How It Works',
            item: `${siteUrl}/how-it-works`,
          },
        ],
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: "When is Jersey's 2026 general election?",
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Jersey's 2026 general election is on Sunday 7 June 2026. This is the first time in recent history that Jersey has held its election on a Sunday.",
          },
        },
        {
          '@type': 'Question',
          name: "How many votes do I get in Jersey's 2026 election?",
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Each voter in Jersey's 2026 election has between 12 and 14 votes depending on their parish: one vote for their parish connétable, up to 9 votes for island-wide senators, and 2–4 votes for their constituency deputies.",
          },
        },
        {
          '@type': 'Question',
          name: "Who can vote in Jersey's 2026 election?",
          acceptedAnswer: {
            '@type': 'Answer',
            text: "You can vote in Jersey's 2026 election if you are registered to vote, are 16 years of age or over on election day, and have lived in Jersey for at least 6 months plus a total of 5 years previously. You do not have to be a British citizen.",
          },
        },
        {
          '@type': 'Question',
          name: 'What are the three types of States Member in Jersey?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Jersey elects three categories of States Member: 9 senators elected island-wide, 28 deputies elected in 9 constituencies, and 12 connétables who are the elected heads of each of Jersey's 12 parishes.",
          },
        },
        {
          '@type': 'Question',
          name: "How many seats are in Jersey's States Assembly?",
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Jersey's States Assembly has 49 elected Members: 9 senators, 28 deputies, and 12 connétables. All 49 are elected on the same day every four years.",
          },
        },
      ],
    },
  ],
}

// ── Page Component ────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  return (
    <>
      {/* Speakable + FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="bg-[#F5F5F0] min-h-screen">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className="bg-[#0D1B2A] border-b border-white/10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">

            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px w-8 bg-[#C8922A]" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
                Voter guide
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold
                           text-[#F5E8C8] leading-tight tracking-tight mb-5">
              How Jersey&rsquo;s 2026{' '}
              <span className="text-[#C8922A]">election works</span>
            </h1>

            {/* AEO lead paragraph — speakable target */}
            <p
              id="how-it-works-lead"
              className="text-base sm:text-lg text-[#F5E8C8]/75 leading-relaxed max-w-2xl"
            >
              Jersey&rsquo;s 2026 general election is on{' '}
              <strong className="text-[#F5E8C8]">Sunday 7 June 2026</strong>.
              Voters elect{' '}
              <strong className="text-[#F5E8C8]">49 States Members</strong>{' '}
              across three categories — senators, deputies, and connétables.
              Depending on your parish, you have between{' '}
              <strong className="text-[#F5E8C8]">12 and 14 votes</strong>.
              This guide explains everything you need to know.
            </p>

            {/* Quick stat row */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { value: '7 June', label: 'Election day', sub: 'Sunday 2026' },
                { value: '49', label: 'Seats to fill', sub: 'States Assembly' },
                { value: '12–14', label: 'Votes per voter', sub: 'Depends on parish' },
                { value: '41.7%', label: '2022 turnout', sub: 'Last election' },
              ].map(s => (
                <div
                  key={s.label}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                >
                  <div className="text-xl font-bold text-[#C8922A]">{s.value}</div>
                  <div className="text-xs font-semibold text-[#F5E8C8]/80 mt-0.5">{s.label}</div>
                  <div className="text-xs text-[#F5E8C8]/40 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

          {/* AEO answer capsule */}
          <section
            id="aeo-how-it-works"
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 mb-16"
            aria-label="Quick summary: how the Jersey election works"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8 bg-[#C8922A]" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
                Quick summary
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#0D1B2A] mb-4">
              The essentials in 60 seconds
            </h2>
            <dl className="space-y-3">
              {[
                {
                  q: 'When?',
                  a: 'Sunday 7 June 2026. Polls open 8am–8pm.',
                },
                {
                  q: 'Who votes?',
                  a: "Anyone registered to vote who is 16+ and has lived in Jersey for at least 6 months (plus 5 years total). Non-British citizens can vote.",
                },
                {
                  q: 'How many votes?',
                  a: '12–14 votes depending on your parish: 1 connétable + up to 9 senators + 2–4 deputies.',
                },
                {
                  q: "What are you electing?",
                  a: '49 States Members across three categories: 9 island-wide senators, 28 constituency deputies, and 12 parish connétables.',
                },
                {
                  q: 'How to register?',
                  a: 'Automatic registration was introduced for 2026. Check your status at vote.je.',
                },
              ].map(({ q, a }) => (
                <div key={q} className="flex gap-3">
                  <dt className="text-sm font-bold text-[#0D1B2A] w-28 flex-shrink-0">
                    {q}
                  </dt>
                  <dd className="text-sm text-[#0D1B2A]/70 leading-relaxed">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── SECTION 1: THREE TYPES ────────────────────────────────── */}
          <div className="flex items-center gap-4 mb-12">
            <div className="h-px flex-1 bg-[#0D1B2A]/10" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D1B2A]/40 flex-shrink-0">
              The three roles
            </span>
            <div className="h-px flex-1 bg-[#0D1B2A]/10" />
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px w-8 bg-[#C8922A]" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
                Who you&rsquo;re electing
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0D1B2A] tracking-tight mb-3">
              Three types of States Member
            </h2>
            <p className="text-base text-[#0D1B2A]/65 leading-relaxed max-w-2xl">
              Unlike most parliaments, Jersey elects three separate categories of member
              to its single-chamber assembly. Each has identical voting rights once elected.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 mb-16">
            {[
              {
                number: '9',
                role: 'Senators',
                colour: '#A31621',
                badge: 'Island-wide',
                badgeBg: 'bg-[#A31621]/10 text-[#A31621]',
                description:
                  'Elected by all Jersey voters regardless of parish. ' +
                  'Senators represent the whole island and have an island-wide ' +
                  'mandate. The position was abolished in 2022 and reinstated ' +
                  'for the 2026 election.',
                votes: 'You vote for up to 9',
                icon: '🏛️',
              },
              {
                number: '28',
                role: 'Deputies',
                colour: '#0D1B2A',
                badge: '9 constituencies',
                badgeBg: 'bg-[#0D1B2A]/10 text-[#0D1B2A]',
                description:
                  'Elected to represent one of nine constituencies based on ' +
                  'parish boundaries. St Helier is split into three ' +
                  'constituencies due to population. Each constituency elects ' +
                  '2–4 deputies.',
                votes: 'You vote for 2–4 in your constituency',
                icon: '🗳️',
              },
              {
                number: '12',
                role: 'Connétables',
                colour: '#1A6B3A',
                badge: '12 parishes',
                badgeBg: 'bg-[#1A6B3A]/10 text-[#1A6B3A]',
                description:
                  "The elected head of each of Jersey's 12 parishes. " +
                  'Connétables divide their time between parish duties and ' +
                  'their role in the States Assembly. One per parish — ' +
                  'sometimes elected unopposed.',
                votes: 'You vote for 1 (your parish)',
                icon: '⛪',
              },
            ].map(item => (
              <div
                key={item.role}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="h-1" style={{ backgroundColor: item.colour }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl" role="img" aria-label={item.role}>
                      {item.icon}
                    </span>
                    <span className="text-3xl font-bold" style={{ color: item.colour }}>
                      {item.number}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#0D1B2A] mb-1">{item.role}</h3>
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-3 ${item.badgeBg}`}>
                    {item.badge}
                  </span>
                  <p className="text-sm text-[#0D1B2A]/65 leading-relaxed mb-4">
                    {item.description}
                  </p>
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-[#0D1B2A]/50 uppercase tracking-wider mb-1">
                      Your vote
                    </p>
                    <p className="text-xs font-semibold text-[#0D1B2A]">{item.votes}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── SECTION 2: HOW MANY VOTES ─────────────────────────────── */}
          <div className="flex items-center gap-4 mb-12">
            <div className="h-px flex-1 bg-[#0D1B2A]/10" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D1B2A]/40 flex-shrink-0">
              Your votes
            </span>
            <div className="h-px flex-1 bg-[#0D1B2A]/10" />
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px w-8 bg-[#C8922A]" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
                Voting power
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0D1B2A] tracking-tight mb-3">
              You have 12–14 votes
            </h2>
            <p className="text-base text-[#0D1B2A]/65 leading-relaxed max-w-2xl">
              Unlike UK Parliament elections where you get one vote, Jersey voters cast
              multiple votes across the three categories. The exact number depends on
              your constituency.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
            <div className="space-y-4">
              {[
                {
                  category: 'Connétable',
                  votes: '1 vote',
                  detail: 'For the head of your parish',
                  colour: '#1A6B3A',
                },
                {
                  category: 'Senators',
                  votes: 'Up to 9 votes',
                  detail: 'Island-wide — same ballot for all Jersey voters',
                  colour: '#A31621',
                },
                {
                  category: 'Deputies',
                  votes: '2–4 votes',
                  detail: 'For your specific constituency (varies by parish)',
                  colour: '#0D1B2A',
                },
              ].map((row, i) => (
                <div key={row.category}>
                  {i > 0 && <div className="border-t border-gray-100 pt-4" />}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: row.colour }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#0D1B2A]">{row.category}</p>
                        <p className="text-xs text-[#0D1B2A]/55 mt-0.5">{row.detail}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold flex-shrink-0" style={{ color: row.colour }}>
                      {row.votes}
                    </span>
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#0D1B2A]">Total</p>
                  <p className="text-base font-bold text-[#C8922A]">12–14 votes</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-16 flex gap-3">
            <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
            <p className="text-sm text-amber-800 leading-relaxed">
              <strong>You don&rsquo;t have to use all your votes.</strong>{' '}
              It&rsquo;s valid to vote for fewer candidates than the maximum allowed.
              Only vote for candidates you actually support — &ldquo;plumping&rdquo;
              (voting for fewer) is a legitimate strategy, especially for senators.
            </p>
          </div>

          {/* ── SECTION 3: WHO CAN VOTE ───────────────────────────────── */}
          <div className="flex items-center gap-4 mb-12">
            <div className="h-px flex-1 bg-[#0D1B2A]/10" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D1B2A]/40 flex-shrink-0">
              Eligibility
            </span>
            <div className="h-px flex-1 bg-[#0D1B2A]/10" />
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px w-8 bg-[#C8922A]" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
                Who can vote
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0D1B2A] tracking-tight mb-3">
              Voting eligibility
            </h2>
            <p className="text-base text-[#0D1B2A]/65 leading-relaxed max-w-2xl">
              Jersey&rsquo;s eligibility rules are more open than the UK. You do not
              need to be a British citizen to vote.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 mb-16">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#1A6B3A] uppercase tracking-wider mb-4">
                ✓ You can vote if you are:
              </h3>
              <ul className="space-y-3">
                {[
                  'Aged 16 or over on 7 June 2026',
                  'Registered to vote (automatic registration introduced for 2026)',
                  'Resident in Jersey for at least 6 months AND 5 years total previously',
                  'Not required to be a British citizen — all nationalities welcome',
                ].map(item => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-[#0D1B2A]/75 leading-relaxed"
                  >
                    <span className="text-[#1A6B3A] font-bold flex-shrink-0 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#C8922A] uppercase tracking-wider mb-4">
                New for 2026:
              </h3>
              <ul className="space-y-3">
                {[
                  'Automatic voter registration — you should be registered automatically if eligible',
                  'Sunday election — first time Jersey has voted on a Sunday',
                  'Senators return — reintroduced after being abolished in 2022',
                  'Residency reduced from 2 years to 6 months (plus 5 year total)',
                ].map(item => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-[#0D1B2A]/75 leading-relaxed"
                  >
                    <span className="text-[#C8922A] font-bold flex-shrink-0 mt-0.5">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── SECTION 4: KEY DATES ──────────────────────────────────── */}
          <div className="flex items-center gap-4 mb-12">
            <div className="h-px flex-1 bg-[#0D1B2A]/10" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D1B2A]/40 flex-shrink-0">
              Timeline
            </span>
            <div className="h-px flex-1 bg-[#0D1B2A]/10" />
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px w-8 bg-[#C8922A]" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
                Key dates
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0D1B2A] tracking-tight mb-3">
              Election timeline
            </h2>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 mb-16">
            {[
              {
                date: '20–22 Apr 2026',
                event: 'Nomination period',
                detail: 'Candidates officially nominated',
                done: true,
                highlight: false,
              },
              {
                date: '27 Apr 2026',
                event: 'Official candidate list published',
                detail: 'Full list published on vote.je',
                done: true,
                highlight: false,
              },
              {
                date: 'May 2026',
                event: 'Campaign period',
                detail: 'Manifestos, hustings, and canvassing',
                done: false,
                highlight: false,
              },
              {
                date: '7 Jun 2026',
                event: 'Election Day',
                detail: 'Polls open 8am–8pm across Jersey',
                done: false,
                highlight: true,
              },
              {
                date: '7–8 Jun 2026',
                event: 'Results declared',
                detail: 'Counting begins after polls close',
                done: false,
                highlight: false,
              },
              {
                date: '19 Jun 2026',
                event: 'New Assembly first meeting',
                detail: 'Chief Minister designate elected by States Members',
                done: false,
                highlight: false,
              },
            ].map(item => (
              <div
                key={item.date}
                className={`flex items-start gap-4 px-5 py-4 ${
                  item.highlight ? 'bg-[#A31621]/5 border-l-2 border-[#A31621]' : ''
                }`}
              >
                <div className="w-28 flex-shrink-0">
                  <span
                    className={`text-xs font-bold ${
                      item.done
                        ? 'text-[#0D1B2A]/30 line-through'
                        : item.highlight
                          ? 'text-[#A31621]'
                          : 'text-[#C8922A]'
                    }`}
                  >
                    {item.date}
                  </span>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${item.done ? 'text-[#0D1B2A]/40' : 'text-[#0D1B2A]'}`}>
                    {item.event}
                    {item.highlight && (
                      <span className="ml-2 text-xs font-bold px-2 py-0.5 bg-[#A31621] text-[#F5E8C8] rounded-full">
                        Election day
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#0D1B2A]/50 mt-0.5">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── SECTION 5: TURNOUT CONTEXT ────────────────────────────── */}
          <div className="bg-[#0D1B2A] rounded-xl p-6 sm:p-8 mb-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8 bg-[#C8922A]" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
                Context
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#F5E8C8] mb-3">
              Why your vote matters more than ever
            </h2>
            <p className="text-sm text-[#F5E8C8]/70 leading-relaxed mb-5">
              Only <strong className="text-[#F5E8C8]">41.7%</strong> of eligible voters
              participated in the 2022 election. The Privileges and Procedures Committee
              noted that &ldquo;our democracy is not going to function well when only a
              third of eligible voters are participating.&rdquo; In 2026, Sunday voting
              and automatic registration aim to increase participation.
            </p>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-bold text-[#C8922A]">41.7%</span>
                <span className="text-sm text-[#F5E8C8]/60">2022 election turnout</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full bg-[#C8922A]" style={{ width: '41.7%' }} />
              </div>
              <p className="text-xs text-[#F5E8C8]/40">Source: Policy Centre Jersey</p>
            </div>
          </div>

          {/* ── SECTION 6: FAQ ────────────────────────────────────────── */}
          <div className="flex items-center gap-4 mb-12">
            <div className="h-px flex-1 bg-[#0D1B2A]/10" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D1B2A]/40 flex-shrink-0">
              Common questions
            </span>
            <div className="h-px flex-1 bg-[#0D1B2A]/10" />
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px w-8 bg-[#C8922A]" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
                FAQ
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0D1B2A] tracking-tight mb-2">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-4 mb-16">
            {[
              {
                q: "Do I need to vote for all my candidates?",
                a: "No. You can vote for fewer than the maximum. Only vote for candidates you genuinely support. Casting votes for candidates you don't support can work against your preferred candidates in some scenarios.",
              },
              {
                q: "What if there's only one candidate for Connétable?",
                a: "In 2022, eight connétable elections were uncontested. When there's only one candidate, you vote for \"none of the above\" if you don't support them. The sole candidate still wins.",
              },
              {
                q: 'Can I vote by post?',
                a: 'Yes. Postal voting is available. You can also vote in person at any polling station in your parish on election day. Pre-poll (early) voting is also available in the days before election day.',
              },
              {
                q: 'What does the States Assembly actually do?',
                a: "The States Assembly is Jersey's parliament. Its 49 elected members debate and vote on laws, taxes, and government policy. They also hold the Government of Jersey to account through scrutiny panels and questions.",
              },
              {
                q: 'Are there political parties in Jersey?',
                a: 'Jersey has a small number of parties — Reform Jersey is the largest, along with Better Way and Jersey Alliance. However, many candidates stand as independents. Party affiliation is shown on candidate profiles on VotePulse.',
              },
              {
                q: "What's the difference between a Senator and a Deputy?",
                a: 'Both are States Members with identical voting rights in the Assembly. The difference is mandate: senators are elected island-wide (all Jersey voters vote for them), while deputies are elected only by voters in their specific constituency.',
              },
            ].map(({ q, a }) => (
              <div
                key={q}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
              >
                <h3 className="text-sm font-bold text-[#0D1B2A] mb-2">{q}</h3>
                <p className="text-sm text-[#0D1B2A]/65 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>

          {/* ── CTA SECTION ───────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8 bg-[#C8922A]" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
                Now you know how to vote
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#0D1B2A] mb-2">
              Research your candidates on VotePulse
            </h2>
            <p className="text-sm text-[#0D1B2A]/65 leading-relaxed mb-6 max-w-xl">
              VotePulse has AI-extracted policy positions for all 135 declared candidates.
              Compare where they stand on housing, healthcare, tax, and every other issue
              that matters to Jersey.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/candidates"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
                           text-sm font-semibold transition-colors
                           bg-[#A31621] text-[#F5E8C8] hover:bg-[#6B1414]
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-[#A31621] focus-visible:ring-offset-2"
              >
                Browse all candidates →
              </Link>
              <Link
                href="/compare"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
                           text-sm font-semibold transition-colors
                           bg-[#0D1B2A]/5 text-[#0D1B2A] hover:bg-[#0D1B2A]/10
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-[#0D1B2A] focus-visible:ring-offset-2"
              >
                Compare candidates
              </Link>
            </div>

            {/* Official sources */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-[#0D1B2A]/40 mb-2 uppercase tracking-wider font-semibold">
                Official sources
              </p>
              <div className="flex flex-wrap gap-4">
                {[
                  { label: 'vote.je', href: 'https://www.vote.je', desc: 'Official voter guide' },
                  {
                    label: 'policy.je',
                    href: 'https://www.policy.je/papers/2026-general-election/',
                    desc: 'Election policy brief',
                  },
                  {
                    label: 'statesassembly.gov.je',
                    href: 'https://statesassembly.gov.je',
                    desc: 'States Assembly',
                  },
                ].map(s => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#A31621] hover:underline focus-visible:outline-none
                               focus-visible:ring-1 focus-visible:ring-[#A31621] rounded-sm"
                  >
                    {s.label} — {s.desc} ↗
                  </a>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
