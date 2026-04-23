import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc, arrayContains } from "drizzle-orm";
import { db } from "@/db";
import { articles, candidates, candidateIssues, issues } from "@/db/schema";
import {
  absoluteAssetUrl,
  candidateMetadataTitle,
  canonicalUrl,
  truncateMetaDescription,
} from "@/lib/seo";
import { ManifestoExpander } from "./manifesto-expander";

export const revalidate = 21600;

export async function generateStaticParams() {
  try {
    const rows = await db.select({ slug: candidates.slug }).from(candidates);
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

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

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCandidate(slug);
  if (!c) {
    return {
      title: { absolute: "Candidate not found - VotePulse" },
      robots: { index: false, follow: false },
    };
  }

  const description =
    truncateMetaDescription(c.aiSummary ?? c.bio, 150) ||
    `${c.name} is standing in ${c.district} for Jersey's 2026 general election. View manifesto context, issue positions, and sources on VotePulse.`;

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
          alt: `${c.name} - VotePulse`,
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
  const aiIssueCards = positions.map((p) => ({
    issue: p.issueName,
    label: p.issueDisplayName,
    position: p.position,
    confidence: p.confidence,
    sourceQuote: p.sourceQuote,
    icon: p.issueIcon,
  }));

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: candidate.name,
    description:
      truncateMetaDescription(candidate.aiSummary ?? candidate.bio, 300) ||
      `${candidate.name} - candidate for ${candidate.district} in Jersey's 2026 general election.`,
    url: canonicalUrl(`/candidates/${slug}`),
    affiliation: {
      "@type": "PoliticalParty",
      name: candidate.party ?? "Independent",
    },
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 md:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />

      <Link
        href="/candidates"
        className="mb-8 inline-flex min-h-10 items-center gap-1.5 rounded-full text-[13px] font-medium text-muted-foreground transition-colors hover:text-jersey-red"
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

      <header className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-card">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(163,22,33,0.10),_transparent_40%),linear-gradient(135deg,rgba(245,245,240,0.95),rgba(255,255,255,0.98))] px-6 py-7 md:px-8 md:py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {candidate.photoUrl ? (
              <img
                src={candidate.photoUrl}
                alt=""
                className="h-24 w-24 flex-shrink-0 rounded-2xl object-cover shadow-card ring-1 ring-black/10 md:h-28 md:w-28"
              />
            ) : (
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl bg-jersey-red text-[28px] font-bold text-on-primary shadow-card ring-1 ring-black/10 md:h-28 md:w-28 md:text-[32px]">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
                <span className="rounded-full border border-jersey-red/15 bg-jersey-red/5 px-3 py-1 text-jersey-red">
                  Candidate profile
                </span>
                <span className="rounded-full border border-border bg-white/80 px-3 py-1 text-muted-foreground">
                  Jersey 2026
                </span>
              </div>

              <h1 className="mt-4 max-w-2xl text-[30px] font-bold leading-tight tracking-tight text-navy [text-wrap:balance] md:text-[38px]">
                {candidate.name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="inline-flex items-center rounded-full border border-border bg-white/80 px-3 py-1.5 font-medium text-navy shadow-card">
                  {candidate.district}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 font-medium shadow-card ${
                    candidate.party
                      ? "border-border bg-white/80 text-muted-foreground"
                      : "border-gold/30 bg-gold/10 text-gold"
                  }`}
                >
                  {candidate.party ?? "Independent"}
                </span>
              </div>

              {candidate.bio && (
                <p className="mt-4 max-w-2xl text-[14px] leading-7 text-muted-foreground [text-wrap:pretty]">
                  {candidate.bio}
                </p>
              )}

              {candidate.sourceUrls.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {candidate.sourceUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-jersey-red/30 hover:text-jersey-red"
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
          </div>
        </div>
      </header>

      {!hasAiData && (
        <section className="mt-10 rounded-2xl border border-border bg-white p-6 text-center shadow-card">
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
            We&apos;re still analysing this candidate&apos;s manifesto and public
            statements. Check back soon for AI-generated summaries and issue
            positions.
          </p>
        </section>
      )}

      {candidate.aiSummary && (
        <section className="mt-10">
          <h2 className="text-[18px] font-bold text-navy">AI Summary</h2>
          <div className="mt-4 space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-card">
            <div className="flex items-center gap-2">
              <span className="text-sm text-amber-600">⚠</span>
              <span className="text-sm font-medium text-amber-700">
                AI-generated summary - always verify with original sources
              </span>
            </div>

            <p className="text-[15px] leading-7 text-slate-800 [text-wrap:pretty]">
              {candidate.aiSummary}
            </p>

            {aiIssueCards.length > 0 && (
              <div className="space-y-3 border-t border-amber-200 pt-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Issue Positions
                </h3>

                {aiIssueCards.map((issue) => (
                  <div
                    key={issue.issue}
                    className="rounded-xl border border-amber-100 bg-white p-4 shadow-card"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {issue.icon && (
                          <span className="text-[15px]">{issue.icon}</span>
                        )}
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                          {issue.label}
                        </span>
                      </div>
                      <ConfidenceBadge value={issue.confidence} />
                    </div>

                    <p className="text-sm leading-6 text-slate-700">
                      {issue.position}
                    </p>

                    {issue.sourceQuote && (
                      <blockquote className="mt-3 border-l-2 border-amber-300 pl-3 text-xs italic leading-6 text-slate-500">
                        &ldquo;{issue.sourceQuote}&rdquo;
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {candidate.manifestoRaw && (
            <ManifestoExpander
              manifestoRaw={candidate.manifestoRaw}
              manifestoUrl={candidate.manifestoUrl}
            />
          )}
        </section>
      )}

      {positions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[18px] font-bold text-navy">
            Source-Anchored Issue Breakdown
          </h2>
          <div className="mt-4 space-y-3">
            {positions.map((p) => (
              <div
                key={p.issueName}
                className="rounded-2xl border border-border bg-white p-5 shadow-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {p.issueIcon && <span className="text-[16px]">{p.issueIcon}</span>}
                    <h3 className="text-[15px] font-semibold text-navy">
                      {p.issueDisplayName}
                    </h3>
                  </div>
                  <ConfidenceBadge value={p.confidence} />
                </div>

                <p className="mt-2 text-[13px] leading-6 text-navy [text-wrap:pretty]">
                  {p.position}
                </p>

                <div className="mt-3 rounded-xl border-l-2 border-jersey-red/30 bg-surface px-4 py-3">
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

      {relatedArticles.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[18px] font-bold text-navy">Related Articles</h2>
          <div className="mt-4 space-y-2">
            {relatedArticles.map((a) => (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-white px-5 py-4 transition-shadow hover:shadow-card-hover"
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

      <footer className="mt-12 border-t border-border pt-5 text-[12px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4 [font-variant-numeric:tabular-nums]">
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
              : "-"}
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

function ConfidenceBadge({ value }: { value: number }) {
  const level = value >= 0.75 ? "High" : value >= 0.45 ? "Medium" : "Low";
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
