import type { Metadata } from "next";
import Link from "next/link";
import { ElectionCountdown } from "@/components/election-countdown";
import { IssueIntelligence } from "@/components/issue-intelligence";
import { generateHomepageJsonLd } from "@/lib/homepage-jsonld";
import { buildPublicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  titleSegment: "Home",
  description:
    "Explore Jersey’s 2026 general election: candidates by parish, AI-assisted manifesto summaries with sources, issue comparisons, and media sentiment — non-partisan and transparent.",
  path: "/",
});

export const revalidate = 21600; // 6 hours — matches cron cycle

const DISTRICTS = [
  "St Helier North", "St Helier Central", "St Helier South",
  "St Saviour", "St Brelade", "St Clement", "St Peter", "St Lawrence",
  "St Mary", "St Ouen", "St John", "Trinity", "Grouville", "St Martin",
] as const;

export default async function Home() {
  const homepageJsonLd = generateHomepageJsonLd();

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageJsonLd),
        }}
      />
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-navy">
        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-on-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-on-primary) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 md:pb-20 md:pt-28">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-jersey-red" />
                <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-on-primary/50">
                  Jersey 2026 General Election
                </span>
              </div>

              <h1 className="mt-5 max-w-2xl text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-on-primary">
                Election Intelligence
                <br />
                <span className="text-gold">for every voter.</span>
              </h1>

              <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-on-primary/60 md:text-[17px]">
                Understand your candidates. Compare their plans. Make an
                informed vote — backed by original sources and transparent AI
                analysis.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/candidates"
                  className="inline-flex items-center gap-2 rounded-md bg-jersey-red px-5 py-2.5 text-[14px] font-semibold text-on-primary transition-colors hover:bg-jersey-red-dark"
                >
                  Browse Candidates
                  <svg
                    viewBox="0 0 16 16"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </Link>
                <Link
                  href="/compare"
                  className="inline-flex items-center gap-2 rounded-md border border-on-primary/20 px-5 py-2.5 text-[14px] font-semibold text-on-primary/80 transition-colors hover:border-on-primary/40 hover:text-on-primary"
                >
                  Compare Issues
                </Link>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <ElectionCountdown />
            </div>
          </div>
        </div>
      </section>

      {/* ── Issue Intelligence ────────────────────────────── */}
      <IssueIntelligence />

      {/* ── How it works ──────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <h2 className="flex-shrink-0 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            How it works
          </h2>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          <StepCard
            n="01"
            title="Collect"
            body="We gather candidate manifestos, public statements and news coverage from Jersey's official channels and local media — every source URL is preserved and linked."
          />
          <StepCard
            n="02"
            title="Analyse"
            body="AI reads each manifesto to extract policy positions, map them to issues and generate plain-language summaries. Confidence scores flag uncertain readings."
          />
          <StepCard
            n="03"
            title="Compare"
            body="Side-by-side comparisons let you see where candidates agree, diverge, or stay silent — across housing, tax, healthcare and every other issue that matters to Jersey."
          />
        </div>

        {/* Trust disclaimer */}
        <div className="mt-8 rounded-lg border border-gold/30 bg-gold/5 px-5 py-4">
          <div className="flex gap-3">
            <svg
              viewBox="0 0 20 20"
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6Zm0 9a1 1 0 100-2 1 1 0 000 2Z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-[13px] font-semibold text-navy">
                AI transparency notice
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Summaries and stance extractions are generated by AI and may
                contain errors. Every claim links back to its source quote and
                original document so you can verify. VotePulse does not endorse
                any candidate or party.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── District grid ─────────────────────────────────── */}
      <section className="border-t border-border bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <h2 className="text-[22px] font-bold tracking-tight text-navy md:text-[26px]">
            All 14 parishes
          </h2>
          <p className="mt-2 max-w-lg text-[14px] text-muted-foreground">
            Jersey&rsquo;s candidates stand in parish-based constituencies.
            Select a parish to see who&rsquo;s running in your area.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {DISTRICTS.map((d) => (
              <Link
                key={d}
                href={`/candidates?district=${encodeURIComponent(d)}`}
                className="rounded-md border border-border bg-surface px-3 py-2.5 text-center text-[13px] font-medium text-navy transition-all hover:border-jersey-red/30 hover:bg-jersey-red/5 hover:text-jersey-red"
              >
                {d}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

// ── Local components ────────────────────────────────────────────────────────

function StepCard({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <article className="bg-white p-6 md:p-8">
      <span className="font-mono text-[11px] tracking-[0.2em] text-jersey-red">
        {n}
      </span>
      <h3 className="mt-2 text-[17px] font-semibold text-navy">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </article>
  );
}
