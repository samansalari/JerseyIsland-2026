import type { Metadata } from "next";
import { buildPublicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  titleSegment: "About",
  description:
    "How VotePulse works, where Jersey 2026 candidate data comes from, our AI transparency rules, and our non-partisan commitment to election coverage.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 md:py-16">
      <h1 className="text-[32px] font-bold tracking-tight text-navy md:text-[40px]">
        About VotePulse
      </h1>

      {/* ── What it is ────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-[20px] font-bold text-navy">What it is</h2>
        <p className="mt-3 text-[15px] leading-[1.75] text-navy/80">
          VotePulse is an independent, open-source election intelligence
          platform built for Jersey&rsquo;s 2026 general election. It exists to
          help voters understand where candidates stand on the issues that
          matter — housing, healthcare, tax, education, the environment and
          more.
        </p>
        <p className="mt-4 text-[15px] leading-[1.75] text-navy/80">
          VotePulse is <strong>not affiliated</strong> with any political party,
          candidate, or government body. It does not accept donations from
          political organisations and does not endorse or oppose any candidate.
        </p>
      </section>

      {/* ── How it works ──────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-navy">How it works</h2>
        <div className="mt-4 space-y-4">
          <Step
            n="1"
            title="Data collection"
            body="Candidate manifestos, public statements and news coverage are collected from publicly available sources — primarily flow.je, vote.je, policy.je and Jersey news outlets. Every piece of source data is stored with its original URL so nothing is lost."
          />
          <Step
            n="2"
            title="AI analysis"
            body="AI (xAI Grok) reads each manifesto to generate plain-language summaries and extract policy positions mapped to specific issues. Each extraction includes the exact source quote from the original text and a confidence score."
          />
          <Step
            n="3"
            title="Labelling &amp; verification"
            body="All AI-generated content is clearly labelled with a warning badge. Users can expand any summary to read the original manifesto text and verify claims against the source quote."
          />
          <Step
            n="4"
            title="Continuous updates"
            body="Data is refreshed every 6 hours. When a candidate's manifesto or public statements change, the system detects the difference (via SHA-256 hash), re-ingests the content, and re-runs the analysis. Previous versions are preserved in an append-only snapshot history."
          />
        </div>
      </section>

      {/* ── Trust & transparency ──────────────────────── */}
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-navy">
          Trust &amp; transparency
        </h2>
        <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-5">
          <ul className="space-y-3 text-[14px] leading-[1.7] text-navy/80">
            <li className="flex gap-3">
              <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-gold/40 text-[11px] font-bold text-gold">
                !
              </span>
              <span>
                <strong>AI summaries may contain errors</strong> or
                misrepresentations. They are starting points for understanding,
                not definitive records.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-gold/40 text-[11px] font-bold text-gold">
                !
              </span>
              <span>
                <strong>Always verify with the original text.</strong> Every AI
                summary links to the full manifesto and the specific quote that
                supports each claim.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-gold/40 text-[11px] font-bold text-gold">
                !
              </span>
              <span>
                <strong>Confidence scores are shown</strong> for every extracted
                position (high, medium, low) so you know how certain the AI
                was about its reading.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-gold/40 text-[11px] font-bold text-gold">
                !
              </span>
              <span>
                <strong>
                  We do not editorially rank, endorse, or oppose any candidate.
                </strong>{" "}
                Candidates are listed alphabetically. Issue comparisons show
                raw data, not editorial judgement.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ── Data sources ──────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-navy">Data sources</h2>
        <p className="mt-3 text-[14px] leading-[1.7] text-navy/80">
          There is no official API for Jersey election data. VotePulse collects
          information from publicly accessible web pages:
        </p>
        <ul className="mt-4 space-y-2">
          <SourceLink
            href="https://flow.je"
            name="flow.je"
            desc="Candidate manifestos and profiles"
          />
          <SourceLink
            href="https://vote.je"
            name="vote.je"
            desc="Voter registration and election information"
          />
          <SourceLink
            href="https://policy.je"
            name="policy.je"
            desc="Policy documents and position papers"
          />
          <SourceLink
            href="#"
            name="Local news outlets"
            desc="BBC Jersey, Bailiwick Express, ITV Channel, JEP (via RSS)"
          />
        </ul>
        <p className="mt-4 text-[13px] leading-[1.7] text-muted-foreground">
          If a source is unavailable or changes format, VotePulse logs the
          failure in its ingest history so gaps are visible rather than silent.
        </p>
      </section>

      {/* ── Contact ───────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-navy">
          Contact &amp; feedback
        </h2>
        <p className="mt-3 text-[15px] leading-[1.75] text-navy/80">
          Found an error? Have a suggestion? We want to hear from you.
        </p>
        <a
          href="mailto:hello@votepulse.je"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-jersey-red px-5 py-2.5 text-[14px] font-semibold text-on-primary transition-colors hover:bg-jersey-red-dark"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="16" height="12" rx="2" />
            <path d="M2 6l8 5 8-5" />
          </svg>
          hello@votepulse.je
        </a>
      </section>

      {/* ── Legal ─────────────────────────────────────── */}
      <section className="mt-12 rounded-xl border border-border bg-white p-6">
        <h2 className="text-[16px] font-bold text-navy">Legal disclaimer</h2>
        <div className="mt-3 space-y-3 text-[13px] leading-[1.7] text-muted-foreground">
          <p>
            VotePulse is a personal project built for public benefit. It is not
            a registered third-party campaigner under Jersey electoral law. If
            registration becomes required, this page will be updated
            accordingly.
          </p>
          <p>
            No personal data is collected from users. VotePulse does not use
            cookies, analytics trackers, or any form of user identification.
          </p>
          <p>
            The information presented is gathered from public sources and
            processed by AI. While every effort is made to ensure accuracy,
            VotePulse makes no warranty about the completeness or correctness
            of any content. For authoritative election information, contact the
            Judicial Greffe or visit{" "}
            <a
              href="https://vote.je"
              className="font-medium text-jersey-red underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              vote.je
            </a>
            .
          </p>
        </div>
      </section>

      <footer className="mt-12 border-t border-border pt-5 text-[12px] text-muted-foreground">
        Last updated: April 2026
      </footer>
    </main>
  );
}

// ── Local components ────────────────────────────────────────────────────────

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-navy font-mono text-[12px] font-bold text-on-primary">
        {n}
      </span>
      <div>
        <h3 className="text-[15px] font-semibold text-navy">{title}</h3>
        <p className="mt-1 text-[14px] leading-[1.7] text-navy/80">{body}</p>
      </div>
    </div>
  );
}

function SourceLink({
  href,
  name,
  desc,
}: {
  href: string;
  name: string;
  desc: string;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-all hover:border-jersey-red/30 hover:shadow-sm"
      >
        <svg
          viewBox="0 0 16 16"
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground/40 transition-colors group-hover:text-jersey-red"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M6 10l4-4" />
          <path d="M9 4.5h2.5V7" />
          <rect x="2" y="6" width="7" height="7" rx="1.5" />
        </svg>
        <div>
          <span className="text-[14px] font-semibold text-navy transition-colors group-hover:text-jersey-red">
            {name}
          </span>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{desc}</p>
        </div>
      </a>
    </li>
  );
}
