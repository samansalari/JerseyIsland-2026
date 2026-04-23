import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { candidates, candidateIssues, issues, articles } from "@/db/schema";
import { eq, desc, arrayContains } from "drizzle-orm";
import { ManifestoExpander } from "./manifesto-expander";
import {
  absoluteAssetUrl,
  candidateMetadataTitle,
  canonicalUrl,
  truncateMetaDescription,
} from "@/lib/seo";

export const revalidate = 21600; // 6 hours

// ── Static params ───────────────────────────────────────────────────────────

export async function generateStaticParams() {
  try {
    const rows = await db
      .select({ slug: candidates.slug })
      .from(candidates);
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

// ── Data fetching ───────────────────────────────────────────────────────────

async function getCandidate(slug: string) {
  const [row] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.slug, slug))
    .limit(1);
  return row ?? null;
}

async function getCandidatePositions(candidateId: string) {
  return db
    .select({
      position: candidateIssues.position,
      sourceQuote: candidateIssues.sourceQuote,
      confidence: candidateIssues.confidence,
      issueName: issues.name,
      issueDisplayName: issues.displayName,
      issueIcon: issues.icon,
    })
    .from(candidateIssues)
    .innerJoin(issues, eq(candidateIssues.issueId, issues.id))
    .where(eq(candidateIssues.candidateId, candidateId))
    .orderBy(issues.displayName);
}

async function getRelatedArticles(candidateId: string) {
  return db
    .select({
      title: articles.title,
      source: articles.source,
      url: articles.url,
      publishedAt: articles.publishedAt,
      aiSentiment: articles.aiSentiment,
    })
    .from(articles)
    .where(arrayContains(articles.candidateMentions, [candidateId]))
    .orderBy(desc(articles.publishedAt))
    .limit(5);
}

// ── Metadata ────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCandidate(slug);
  if (!c) {
    return {
      title: { absolute: "Candidate not found — VotePulse" },
      robots: { index: false, follow: false },
    };
  }

  const description =
    truncateMetaDescription(c.aiSummary ?? c.bio, 150) ||
    `${c.name} is standing in ${c.district} for Jersey’s 2026 general election. View manifesto context, issue positions, and sources on VotePulse.`;

  const url = canonicalUrl(`/candidates/${slug}`);
  const ogImagePath = `/candidates/${slug}/opengraph-image`;
  const ogImageUrl = absoluteAssetUrl(ogImagePath);

  const titleAbsolute = candidateMetadataTitle(c.name);

  return {
    title: { absolute: titleAbsolute },
    description,
    alternates: { canonical: url },
    openGraph: {
      title: titleAbsolute,
      description,
      url,
      type: "profile",
      locale: "en_GB",
      siteName: "VotePulse",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${c.name} — VotePulse`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: titleAbsolute,
      description,
      images: [ogImageUrl],
    },
    robots: { index: true, follow: true },
  };
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function CandidatePage({ params }: Props) {
  const { slug } = await params;
  const candidate = await getCandidate(slug);
  if (!candidate) notFound();

  const [positions, relatedArticles] = await Promise.all([
    getCandidatePositions(candidate.id),
    getRelatedArticles(candidate.id),
  ]);

  const initials = candidate.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasAiData = !!candidate.aiSummary || positions.length > 0;

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: candidate.name,
    description:
      truncateMetaDescription(candidate.aiSummary ?? candidate.bio, 300) ||
      `${candidate.name} — candidate for ${candidate.district} in Jersey’s 2026 general election.`,
    url: canonicalUrl(`/candidates/${slug}`),
    affiliation: {
      "@type": "PoliticalParty",
      name: candidate.party ?? "Independent",
    },
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      {/* Back link */}
      <Link
        href="/candidates"
        className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-jersey-red"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 12 6 8l4-4" />
        </svg>
        All candidates
      </Link>

      {/* ── 1. Header ────────────────────────────────────── */}
      <header className="flex gap-5">
        {candidate.photoUrl ? (
          <img
            src={candidate.photoUrl}
            alt=""
            className="h-20 w-20 flex-shrink-0 rounded-xl object-cover md:h-24 md:w-24"
          />
        ) : (
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-jersey-red text-[24px] font-bold text-on-primary md:h-24 md:w-24 md:text-[28px]">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-navy md:text-[34px]">
            {candidate.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-1 font-medium text-navy">
              {candidate.district}
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-1 font-medium ${
                candidate.party
                  ? "border-border bg-muted/50 text-muted-foreground"
                  : "border-gold/30 bg-gold/10 text-gold"
              }`}
            >
              {candidate.party ?? "Independent"}
            </span>
          </div>
          {/* Source pills */}
          {candidate.sourceUrls.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {candidate.sourceUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-jersey-red/30 hover:text-jersey-red"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M6 10l4-4" />
                    <path d="M9 4.5h2.5V7" />
                    <rect x="2" y="6" width="7" height="7" rx="1.5" />
                  </svg>
                  Source
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── No AI data state ─────────────────────────────── */}
      {!hasAiData && (
        <section className="mt-10 rounded-xl border border-border bg-white p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-muted-foreground/50"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l2 2" />
            </svg>
          </div>
          <p className="mt-3 text-[15px] font-semibold text-navy">
            Processing in progress
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            We&rsquo;re still analysing this candidate&rsquo;s manifesto and
            public statements. Check back soon for AI-generated summaries and
            issue positions.
          </p>
        </section>
      )}

      {/* ── 2. AI Summary ────────────────────────────────── */}
      {candidate.aiSummary && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-navy">
              AI-Generated Summary
            </h2>
          </div>
          <div className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-gold">
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6Zm0 9a1 1 0 100-2 1 1 0 000 2Z"
                  clipRule="evenodd"
                />
              </svg>
              AI-generated — verify with original sources
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-navy">
              {candidate.aiSummary}
            </p>
          </div>

          {/* Expandable manifesto */}
          {candidate.manifestoRaw && (
            <ManifestoExpander
              manifestoRaw={candidate.manifestoRaw}
              manifestoUrl={candidate.manifestoUrl}
            />
          )}
        </section>
      )}

      {/* ── 3. Issues & Positions ────────────────────────── */}
      {positions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[18px] font-bold text-navy">
            Issues &amp; Positions
          </h2>
          <div className="mt-4 space-y-3">
            {positions.map((p) => (
              <div
                key={p.issueName}
                className="rounded-xl border border-border bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.issueIcon && (
                      <span className="text-[16px]">{p.issueIcon}</span>
                    )}
                    <h3 className="text-[15px] font-semibold text-navy">
                      {p.issueDisplayName}
                    </h3>
                  </div>
                  <ConfidenceBadge value={p.confidence} />
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-navy">
                  {p.position}
                </p>
                {/* Source quote */}
                <div className="mt-3 rounded-lg border-l-2 border-jersey-red/30 bg-surface pl-4 pr-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                    Source quote
                  </p>
                  <p className="mt-1 text-[12px] italic leading-relaxed text-muted-foreground">
                    &ldquo;{p.sourceQuote}&rdquo;
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 4. Related Articles ──────────────────────────── */}
      {relatedArticles.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[18px] font-bold text-navy">
            Related Articles
          </h2>
          <div className="mt-4 space-y-2">
            {relatedArticles.map((a) => (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-4 rounded-lg border border-border bg-white px-5 py-4 transition-shadow hover:shadow-card-hover"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-navy transition-colors group-hover:text-jersey-red">
                    {a.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <span className="font-medium">{a.source}</span>
                    {a.publishedAt && (
                      <>
                        <span className="text-border">·</span>
                        <span>
                          {new Date(a.publishedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </>
                    )}
                    {a.aiSentiment && (
                      <>
                        <span className="text-border">·</span>
                        <SentimentBadge sentiment={a.aiSentiment} />
                      </>
                    )}
                  </div>
                </div>
                <svg
                  viewBox="0 0 16 16"
                  className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground/40 transition-colors group-hover:text-jersey-red"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M6 10l4-4M9 4.5h2.5V7" />
                </svg>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── 5. Last updated ──────────────────────────────── */}
      <footer className="mt-12 border-t border-border pt-5 text-[12px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <span>
            Last scraped:{" "}
            {candidate.lastScrapedAt
              ? new Date(candidate.lastScrapedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
          {candidate.lastEnrichedAt && (
            <span>
              AI enriched:{" "}
              {new Date(candidate.lastEnrichedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <span>
            Record updated:{" "}
            {new Date(candidate.updatedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </footer>
    </main>
  );
}

// ── Local components ────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const level =
    value >= 0.75 ? "High" : value >= 0.45 ? "Medium" : "Low";
  const color =
    value >= 0.75
      ? "border-success/30 bg-success/10 text-success"
      : value >= 0.45
        ? "border-gold/30 bg-gold/10 text-gold"
        : "border-jersey-red/30 bg-jersey-red/10 text-jersey-red";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${color}`}
      title={`Confidence: ${Math.round(value * 100)}%`}
    >
      {level} confidence
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    positive: { label: "Positive", cls: "text-success" },
    negative: { label: "Critical", cls: "text-jersey-red" },
    neutral: { label: "Neutral", cls: "text-muted-foreground" },
  };
  const s = map[sentiment] ?? map.neutral!;
  return <span className={`font-medium ${s.cls}`}>{s.label}</span>;
}
