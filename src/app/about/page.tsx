import type { Metadata } from "next";
import {
  BuyMeABeerButton,
  ContactButton,
  RemovalButton,
} from "@/components/about-actions";

export const metadata: Metadata = {
  title: "About VotePulse — Jersey 2026 Election Intelligence",
  description:
    "VotePulse is a free, independent election intelligence platform for Jersey's 2026 general election. No ads. No affiliation. No agenda.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="mx-auto max-w-3xl px-4 py-14">
        {/* ── HERO ──────────────────────────────────────────────── */}
        <div className="mb-12">
          <h1 className="mb-4 text-4xl font-bold leading-tight text-[#0D1B2A]">
            About VotePulse
          </h1>
          <p className="text-lg leading-relaxed text-[#0D1B2A]/70">
            One place. Every candidate. No spin.
          </p>
        </div>

        {/* ── WHAT IT IS ────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-[#0D1B2A]">What it is</h2>
          <div className="space-y-4 leading-relaxed text-[#0D1B2A]/80">
            <p>
              VotePulse is a free, independent platform built to make
              Jersey&apos;s 2026 general election easier to navigate. We gather
              publicly available information about every declared candidate and
              bring it together in one place — so you can compare, explore, and
              decide for yourself.
            </p>
            <p>
              We have no political affiliation. We do not endorse, promote, or
              oppose any candidate or party. We do not accept money from any
              political organisation, campaign, or government body.
            </p>
            <p>
              VotePulse was built because Jersey voters deserved a single,
              structured view of who is standing and what they stand for.
              Nothing more.
            </p>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-6 text-xl font-bold text-[#0D1B2A]">How it works</h2>
          <div className="space-y-4">
            <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: "#0D1B2A", color: "#F5E8C8" }}
              >
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-[#0D1B2A]">
                  We gather public information
                </h3>
                <p className="text-sm leading-relaxed text-[#0D1B2A]/65">
                  Candidate profiles, manifestos, and public statements are
                  collected from publicly accessible web pages. Every piece of
                  information is linked back to its original source so you can
                  always verify it yourself.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: "#0D1B2A", color: "#F5E8C8" }}
              >
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-[#0D1B2A]">
                  AI reads and summarises instantly
                </h3>
                <p className="text-sm leading-relaxed text-[#0D1B2A]/65">
                  Our AI engine reads each candidate&apos;s manifesto and
                  generates a plain-language summary — in seconds. It also
                  extracts their position on key issues like housing, healthcare,
                  and tax, giving you a confidence score for each extraction so
                  you know how certain the AI was.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: "#0D1B2A", color: "#F5E8C8" }}
              >
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-[#0D1B2A]">
                  Everything is labelled and verifiable
                </h3>
                <p className="text-sm leading-relaxed text-[#0D1B2A]/65">
                  Every AI-generated summary is clearly marked. Every extracted
                  position links to the exact quote from the original manifesto
                  text. We never present AI output as fact — it is always a
                  starting point, not a definitive record.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: "#0D1B2A", color: "#F5E8C8" }}
              >
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-[#0D1B2A]">
                  Kept up to date
                </h3>
                <p className="text-sm leading-relaxed text-[#0D1B2A]/65">
                  As candidates update their manifestos or publish new
                  statements, VotePulse detects the changes and re-analyses the
                  content automatically. What you see reflects the most
                  current publicly available information.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUST & TRANSPARENCY ──────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-[#0D1B2A]">
            Trust &amp; transparency
          </h2>
          <div
            className="space-y-4 rounded-xl border p-5"
            style={{ backgroundColor: "#FFF9E6", borderColor: "#FFE099" }}
          >
            {[
              {
                icon: "⚠",
                text: (
                  <>
                    <strong>AI summaries may contain errors.</strong> They are
                    starting points for understanding, not authoritative records.
                    Always read the original before making decisions.
                  </>
                ),
              },
              {
                icon: "🔗",
                text: (
                  <>
                    <strong>Every summary links to its original source.</strong>{" "}
                    You can read the candidate&apos;s own words at any time.
                  </>
                ),
              },
              {
                icon: "📊",
                text: (
                  <>
                    <strong>Confidence scores are shown</strong> for every
                    extracted position — high, medium, or low — so you know how
                    certain the AI was about each reading.
                  </>
                ),
              },
              {
                icon: "⚖",
                text: (
                  <>
                    <strong>
                      We do not rank, endorse, or oppose any candidate.
                    </strong>{" "}
                    Candidates are listed alphabetically. Issue comparisons show
                    raw data, not editorial judgement.
                  </>
                ),
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <span
                  className="mt-0.5 flex-shrink-0 text-base"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <p className="text-sm leading-relaxed text-[#0D1B2A]/80">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── YOUR INFORMATION ──────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-[#0D1B2A]">
            Your information on VotePulse
          </h2>
          <div className="space-y-4 leading-relaxed text-[#0D1B2A]/80">
            <p>
              All information displayed about candidates is drawn from publicly
              available sources. We do not collect or store any personal data
              about visitors to this site. No cookies, no analytics trackers, no
              login required.
            </p>
            <p>
              If you are a candidate and believe any information about you on
              VotePulse is inaccurate, incomplete, or you would like it removed,
              you can contact us directly. We will review your request and update
              or remove the information promptly.
            </p>
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 font-semibold text-[#0D1B2A]">
                Request correction or removal
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-[#0D1B2A]/65">
                Are you a candidate? Found something incorrect? Want your
                information removed? We will act on your request — no questions
                asked.
              </p>
              <RemovalButton />
            </div>
          </div>
        </section>

        {/* ── CONTACT & FEEDBACK ────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-[#0D1B2A]">
            Contact &amp; feedback
          </h2>
          <p className="mb-5 leading-relaxed text-[#0D1B2A]/80">
            Found an error? Have a suggestion? Something not working? We want to
            hear from you.
          </p>
          <ContactButton />
        </section>

        {/* ── SUPPORT THE PROJECT ───────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-[#0D1B2A]">
            Support the project
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="mb-2 leading-relaxed text-[#0D1B2A]/80">
              VotePulse is free, independent, and runs entirely on personal time.
              There are no ads, no subscriptions, and no commercial backing.
            </p>
            <p className="mb-6 leading-relaxed text-[#0D1B2A]/80">
              If you find it useful and want to say thanks, you can buy the
              developer a beer. Entirely optional — VotePulse will always be
              free.
            </p>
            <BuyMeABeerButton />
            <p className="mt-3 text-xs" style={{ color: "rgba(13,27,42,0.40)" }}>
              Powered by Buy Me a Coffee. No payment data is handled by
              VotePulse.
            </p>
          </div>
        </section>

        {/* ── LEGAL DISCLAIMER ──────────────────────────────────── */}
        <section className="mb-8">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-base font-bold text-[#0D1B2A]">
              Legal disclaimer
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-[#0D1B2A]/65">
              <p>
                VotePulse is an independent personal project built for public
                benefit. It is not affiliated with any political party,
                candidate, electoral authority, or government body.
              </p>
              <p>
                All information displayed is gathered from publicly available
                sources and processed by AI. While every effort is made to
                ensure accuracy, VotePulse makes no warranty about the
                completeness or correctness of any content. For authoritative
                election information, visit{" "}
                <a
                  href="https://www.vote.je"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#A31621] transition-colors hover:underline"
                >
                  vote.je
                </a>
                .
              </p>
              <p>
                No personal data about visitors is collected. Candidate
                information displayed is limited to publicly available public
                interest material. Any candidate may request correction or
                removal of their information by contacting{" "}
                <a
                  href="mailto:hello@votepulse.je"
                  className="text-[#A31621] transition-colors hover:underline"
                >
                  hello@votepulse.je
                </a>
                .
              </p>
              <p>
                VotePulse does not accept financial contributions from any
                political party, campaign, candidate, or political organisation.
                Support received through Buy Me a Coffee is a personal
                contribution to the developer and is unrelated to any electoral
                activity.
              </p>
            </div>
          </div>
        </section>

        <p
          className="text-center text-xs"
          style={{ color: "rgba(13,27,42,0.35)" }}
        >
          Last updated: April 2026
        </p>
      </div>
    </div>
  );
}
