import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, arrayContains, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  articles,
  candidateIssues,
  candidates,
  issues,
  type ActionPoint,
  type ElectionRecord,
  type IssueStance,
} from "@/db/schema";
import { generateCandidateJsonLd } from "@/lib/candidate-jsonld";
import {
  absoluteAssetUrl,
  canonicalUrl,
  siteBase,
  truncateMetaDescription,
} from "@/lib/seo";
import { SocialLinks } from "@/components/social-links";
import { safeDisplayName } from "@/lib/candidate-utils";
import {
  cleanManifestoForDisplay,
  isManifestoMeaningless,
} from "@/lib/clean-manifesto";
import { ManifestoContent } from "@/components/manifesto-content";

export const revalidate = 21600;

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Turn a raw `source_urls` URL into a friendly label for the data-sources list.
 * The DB stores plain URL strings; we derive labels from the host + path.
 */
function getSourceLabel(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  const path = parsed.pathname;

  // vote.je archive: /candidates/2016/alvin-aaron/ → "2016 Vote.je manifesto"
  const voteJeYear = path.match(/\/candidates\/(\d{4})\//);
  if (host.endsWith("vote.je") && voteJeYear) {
    return `${voteJeYear[1]} Vote.je manifesto`;
  }

  if (host.endsWith("vote.je")) {
    if (path.includes("/2026/")) return "2026 Vote.je profile";
    if (path.includes("/candidate")) return "Vote.je candidate profile";
    return "Vote.je";
  }

  if (host.endsWith("flow.je")) return "Flow.je profile";

  if (host.endsWith("youtube.com") || host === "youtu.be") {
    return "YouTube video";
  }

  if (host.endsWith("sosjersey.co.uk")) return "SOS Jersey Q&A";

  if (host.endsWith("wikipedia.org")) return "Wikipedia";

  if (host.endsWith("bbc.co.uk") || host.endsWith("bbc.com")) {
    return "BBC News";
  }

  if (host.endsWith("itv.com")) return "ITV News";

  if (host.endsWith("jerseyeveningpost.com") || host === "jep.je") {
    return "Jersey Evening Post";
  }

  if (host.endsWith("bailiwickexpress.com")) return "Bailiwick Express";

  if (host.endsWith("gov.je")) return "gov.je";

  return host;
}

export async function generateStaticParams() {
  try {
    const rows = await db
      .select({ slug: candidates.slug })
      .from(candidates)
      .where(eq(candidates.is2026, true));
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

async function getCandidate(slug: string) {
  const [row] = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.slug, slug), eq(candidates.is2026, true)))
    .limit(1);
  return row ?? null;
}

type RenderedPosition = {
  issueName: string;
  issueDisplayName: string;
  position: string;
  sourceQuote: string;
  confidence: number;
  stanceType: NonNullable<IssueStance["stanceType"]>;
  actionPoints: ActionPoint[];
};

/**
 * Merge the structured action-points data from `candidates.ai_issues` (jsonb)
 * with the `candidate_issues` junction table. The junction table is the
 * authoritative source for which issues to render (it has display names via
 * `issues`), while jsonb carries the new `stanceType` / `actionPoints` fields.
 *
 * Falls back gracefully when a candidate hasn't been re-enriched under the
 * action-points pipeline yet — `actionPoints` is `[]` and `stanceType` is
 * `"neutral"`, so the existing position paragraph + quote still render.
 */
async function getCandidatePositions(
  candidateId: string,
  aiIssuesJsonb: unknown,
): Promise<RenderedPosition[]> {
  const rows = await db
    .select({
      position: candidateIssues.position,
      sourceQuote: candidateIssues.sourceQuote,
      confidence: candidateIssues.confidence,
      issueName: issues.name,
      issueDisplayName: issues.displayName,
    })
    .from(candidateIssues)
    .innerJoin(issues, eq(candidateIssues.issueId, issues.id))
    .where(eq(candidateIssues.candidateId, candidateId))
    .orderBy(issues.displayName);

  const stanceMap = new Map<string, IssueStance>();
  if (Array.isArray(aiIssuesJsonb)) {
    for (const stance of aiIssuesJsonb as IssueStance[]) {
      if (stance && typeof stance.issue === "string") {
        stanceMap.set(stance.issue, stance);
      }
    }
  }

  return rows.map((r) => {
    const stance = stanceMap.get(r.issueName);
    return {
      issueName: r.issueName,
      issueDisplayName: r.issueDisplayName,
      position: r.position,
      sourceQuote: r.sourceQuote,
      confidence: r.confidence,
      stanceType: stance?.stanceType ?? "neutral",
      actionPoints: Array.isArray(stance?.actionPoints)
        ? stance.actionPoints
        : [],
    };
  });
}

async function getRelatedArticles(candidateId: string) {
  return db
    .select({
      title: articles.title,
      source: articles.source,
      url: articles.url,
      publishedAt: articles.publishedAt,
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
      title: { absolute: "Candidate not found | VotePulse" },
      robots: { index: false, follow: false },
    };
  }

  const siteUrl = siteBase();
  const url = canonicalUrl(`/candidates/${slug}`);
  const displayName = safeDisplayName(c.name);
  const titleAbsolute = `${displayName} — Jersey 2026 election | VotePulse`;

  const description = [
    `${displayName} is standing in ${c.district}`,
    `in Jersey's 2026 general election on 7 June 2026`,
    c.party ? `representing ${c.party}` : "as an Independent",
    c.aiSummary
      ? ". " + (c.aiSummary.split(/[.!?]/)[0]?.trim() ?? "") + "."
      : ". View their manifesto and policy positions on VotePulse.",
  ].join(" ");

  const ogImageUrl = absoluteAssetUrl(`/api/og?slug=${c.slug}`);

  return {
    title: { absolute: titleAbsolute },
    description,
    keywords: [
      displayName,
      `${displayName} Jersey`,
      `${displayName} 2026 election`,
      c.district,
      "Jersey election 2026",
      "Jersey candidates",
      c.party ?? "independent candidate Jersey",
    ],
    authors: [{ name: "VotePulse", url: siteUrl }],
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
          alt: `${displayName} — Jersey 2026 Election | VotePulse`,
          type: "image/png",
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
    other: {
      "article:section": "Election Candidates",
      "article:tag": `Jersey 2026, ${c.district ?? "Jersey"}, ${c.party ?? "Independent"}`,
      "geo.region": "JE",
      "geo.placename": `${c.district ?? "Jersey"}, Jersey, Channel Islands`,
      "geo.position": "49.2144;-2.1312",
      ICBM: "49.2144, -2.1312",
    },
  };
}

export default async function CandidatePage({ params }: Props) {
  const { slug } = await params;
  const candidate = await getCandidate(slug);
  if (!candidate) notFound();

  const [positions, relatedArticles] = await Promise.all([
    getCandidatePositions(candidate.id, candidate.aiIssues),
    getRelatedArticles(candidate.id),
  ]);

  const candidateDisplayName = safeDisplayName(candidate.name);
  const initials = candidateDisplayName
    .split(" ")
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://votepulse.je";
  const jsonLd = generateCandidateJsonLd(candidate, siteUrl);

  const displayManifesto = cleanManifestoForDisplay(candidate.manifestoRaw ?? "");
  const hasManifestoBody =
    displayManifesto.length > 0 && !isManifestoMeaningless(candidate.manifestoRaw);
  const electionHistory = (candidate.electionHistory ?? []) as ElectionRecord[];
  // 2026 content heuristic: explicit AI summary, extracted positions, or a
  // long manifesto that mentions the year. Used to gate the "no 2026" notice.
  const isHistoricalRecord = (candidate.manifestoRaw ?? "").startsWith(
    "[Historical manifesto from vote.je",
  );
  const has2026Content =
    !isHistoricalRecord &&
    (Boolean(candidate.aiSummary) ||
      positions.length > 0 ||
      (displayManifesto.length > 300 &&
        displayManifesto.toLowerCase().includes("2026")));
  const sourceUrls = candidate.sourceUrls ?? [];

  return (
    <div className="min-h-screen bg-surface">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <Link
            href="/candidates"
            className="mb-6 inline-flex min-h-10 items-center gap-1.5 rounded-full text-sm font-medium text-on-primary/80 transition-colors hover:text-on-primary"
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

          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex-shrink-0">
              {candidate.photoUrl ? (
                <img
                  src={candidate.photoUrl}
                  alt={candidateDisplayName}
                  className="h-20 w-20 rounded-full border-2 border-gold object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold bg-jersey-red text-2xl font-bold text-on-primary">
                  {initials}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold leading-tight text-on-primary [text-wrap:balance]">
                {candidateDisplayName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {candidate.role && (
                  <span className="inline-flex items-center rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold ring-1 ring-inset ring-gold/30">
                    {candidate.role}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm text-on-primary">
                  <span aria-hidden>📍</span>
                  {candidate.district}
                </span>
                {candidate.party && candidate.party !== "Independent" ? (
                  <span className="inline-flex items-center rounded-full bg-jersey-red px-3 py-1 text-sm text-on-primary">
                    {candidate.party}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-sm text-on-primary">
                    Independent
                  </span>
                )}
              </div>

              <SocialLinks
                rawLinks={candidate.socialLinks as Record<string, string>}
                theme="dark"
              />

              {candidate.bio && (
                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-on-primary/80 [text-wrap:pretty]">
                  {stripMarkdown(candidate.bio)}
                </p>
              )}
            </div>

            <div className="flex-shrink-0">
              {candidate.manifestoUrl && (
                <a
                  href={candidate.manifestoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-white/5"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  View source
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        {candidate.aiSummary && (
          <section
            id="aeo-candidate-lead"
            className="rounded-xl border border-amber-200 bg-amber-50 p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="text-base text-amber-500">⚠</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                AI-Generated Summary
              </span>
              <span className="ml-1 text-xs text-amber-600">
                - verify with original sources below
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-800 [text-wrap:pretty]">
              {candidate.aiSummary}
            </p>
          </section>
        )}

        {positions.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Issue Positions
              <span className="ml-2 text-xs font-normal text-slate-400">
                AI-extracted
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {positions.map((item) => (
                <IssuePositionCard key={item.issueName} item={item} />
              ))}
            </div>
          </section>
        )}

        {hasManifestoBody || sourceUrls.length > 0 ? (
          <section className="mt-2">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px w-8 bg-[#C8922A]" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
                Original Manifesto
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {!has2026Content && hasManifestoBody && (
                <div
                  className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4"
                  role="status"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex-shrink-0 text-base text-amber-500"
                  >
                    ⚠
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      No 2026 manifesto published yet
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-amber-700">
                      Showing historical electoral profile from flow.je and
                      vote.je. This content is from a previous election and may
                      not reflect the candidate&rsquo;s current positions.
                    </p>
                  </div>
                </div>
              )}

              {hasManifestoBody ? (
                <ManifestoContent raw={candidate.manifestoRaw ?? ""} />
              ) : (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm italic text-[#0D1B2A]/40">
                    No manifesto text available yet.
                  </p>
                  {candidate.manifestoUrl && (
                    <a
                      href={candidate.manifestoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#A31621] hover:underline"
                    >
                      View on vote.je ↗
                    </a>
                  )}
                </div>
              )}

              {sourceUrls.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0D1B2A]/50 transition-colors hover:text-[#0D1B2A]/70">
                      <svg
                        className="h-3 w-3 transition-transform group-open:rotate-90"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      Data sources ({sourceUrls.length})
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {sourceUrls.map((url, i) => (
                        <li key={`${url}-${i}`}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-[#A31621] hover:underline"
                          >
                            <svg
                              className="h-3 w-3 flex-shrink-0 opacity-60"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                            {getSourceLabel(url)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
            </div>
          </section>
        ) : electionHistory.length === 0 ? (
          <section>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400 shadow-sm">
              <p className="text-sm">
                No manifesto or profile text available for this candidate yet.
              </p>
              {candidate.manifestoUrl && (
                <a
                  href={candidate.manifestoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-jersey-red hover:underline"
                >
                  Check their flow.je profile →
                </a>
              )}
            </div>
          </section>
        ) : null}

        {electionHistory.length > 0 && (
          <ElectionHistorySection
            history={electionHistory}
            candidateName={candidateDisplayName}
          />
        )}

        {relatedArticles.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              In the News
            </h2>
            <div className="space-y-3">
              {relatedArticles.map((article) => (
                <a
                  key={article.url}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-jersey-red/30 hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-slate-900 transition-colors group-hover:text-jersey-red">
                      {article.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {article.source}
                      </span>
                      {article.publishedAt && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-400">
                            {new Date(article.publishedAt).toLocaleDateString(
                              "en-GB",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 transition-colors group-hover:text-jersey-red"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              ))}
            </div>
          </section>
        )}

        <footer className="border-t border-border pt-5 text-[12px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4 [font-variant-numeric:tabular-nums]">
            {candidate.lastEnrichedAt && (
              <span>
                Last updated:{" "}
                {new Date(candidate.lastEnrichedAt).toLocaleDateString(
                  "en-GB",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  },
                )}
              </span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const level = value > 0.8 ? "High" : value > 0.5 ? "Medium" : "Low";
  const color =
    value > 0.8
      ? "bg-green-100 text-green-700"
      : value > 0.5
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
      title={`Confidence: ${Math.round(value * 100)}%`}
    >
      {level}
    </span>
  );
}

const STANCE_STYLE: Record<
  NonNullable<IssueStance["stanceType"]>,
  { label: string; bg: string; text: string; border: string }
> = {
  supportive: {
    label: "Has proposals",
    bg: "rgba(26,107,58,0.10)",
    text: "#1A6B3A",
    border: "rgba(26,107,58,0.20)",
  },
  opposing: {
    label: "Opposed",
    bg: "rgba(163,22,33,0.10)",
    text: "#A31621",
    border: "rgba(163,22,33,0.20)",
  },
  concerned: {
    label: "Concerned",
    bg: "rgba(200,146,42,0.10)",
    text: "#C8922A",
    border: "rgba(200,146,42,0.20)",
  },
  neutral: {
    label: "Mentions",
    bg: "rgba(13,27,42,0.06)",
    text: "#0D1B2A",
    border: "rgba(13,27,42,0.15)",
  },
};

function StanceBadge({
  stance,
}: {
  stance: NonNullable<IssueStance["stanceType"]>;
}) {
  const s = STANCE_STYLE[stance];
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
    >
      {s.label}
    </span>
  );
}

function IssuePositionCard({ item }: { item: RenderedPosition }) {
  const hasActionPoints = item.actionPoints.length > 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-jersey-red">
          {item.issueDisplayName}
        </span>
        <div className="flex items-center gap-2">
          {item.stanceType === "supportive" && (
            <StanceBadge stance="supportive" />
          )}
          <ConfidenceBadge value={item.confidence} />
        </div>
      </div>

      <p className="text-sm leading-relaxed text-slate-700 [text-wrap:pretty]">
        {item.position}
      </p>

      {hasActionPoints ? (
        <>
          <div className="my-3 h-px bg-gray-100" />
          <ul className="space-y-2">
            {item.actionPoints.map((ap, i) => {
              const isOpposition = ap.type === "opposition";
              const iconColour = isOpposition ? "#A31621" : "#1A6B3A";
              return (
                <li key={i} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-0.5 flex-shrink-0 text-sm leading-none"
                    style={{ color: iconColour }}
                  >
                    {isOpposition ? "✗" : "✓"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-[#0D1B2A]">
                      {ap.text}
                    </p>
                    {ap.sourceQuote && (
                      <p className="mt-1 border-l border-gray-200 pl-2 text-xs italic text-[#0D1B2A]/45">
                        &ldquo;{ap.sourceQuote}&rdquo;
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : item.sourceQuote ? (
        <blockquote className="mt-3 border-l-2 border-gold pl-3 text-xs italic text-slate-500">
          &quot;{item.sourceQuote}&quot;
        </blockquote>
      ) : null}
    </div>
  );
}

function ElectionHistorySection({
  history,
  candidateName,
}: {
  history: ElectionRecord[];
  candidateName: string;
}) {
  return (
    <section className="mt-2">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-px w-8 bg-[#C8922A]" />
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8922A]">
          Election history
        </span>
        <span className="text-xs text-slate-400">
          {history.length} {history.length === 1 ? "election" : "elections"}
        </span>
      </div>

      <div className="space-y-4">
        {history.map((record, i) => (
          <ElectionRecordCard
            key={`${record.year}-${i}`}
            record={record}
            candidateName={candidateName}
          />
        ))}
      </div>
    </section>
  );
}

function ElectionRecordCard({
  record,
  candidateName,
}: {
  record: ElectionRecord;
  candidateName: string;
}) {
  const rows = record.allResults ?? [];
  const hasFooter =
    record.totalVotes !== null ||
    record.registeredVoters !== null ||
    record.turnout !== null ||
    (record.sources?.length ?? 0) > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#0D1B2A] [text-wrap:balance]">
              {record.electionName}
            </h3>
            {(record.role && record.role !== record.electionName) ||
            record.date ||
            record.seats ? (
              <p className="mt-0.5 text-xs text-[#0D1B2A]/55 [font-variant-numeric:tabular-nums]">
                {record.role && record.role !== record.electionName
                  ? record.role
                  : null}
                {record.role &&
                record.role !== record.electionName &&
                record.date
                  ? " · "
                  : null}
                {record.date}
                {(record.role !== record.electionName || record.date) &&
                record.seats !== null
                  ? " · "
                  : null}
                {record.seats !== null
                  ? `${record.seats} seat${record.seats !== 1 ? "s" : ""}`
                  : null}
              </p>
            ) : null}
            {record.party && (
              <p className="mt-1 text-xs text-[#0D1B2A]/55">
                Stood for{" "}
                <span className="font-medium text-[#0D1B2A]/80">
                  {record.party}
                </span>
              </p>
            )}
          </div>
          <ResultBadge result={record.result} />
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs [font-variant-numeric:tabular-nums]">
            <thead>
              <tr className="border-b border-gray-100 text-[#0D1B2A]/50">
                <th className="w-8 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  #
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  Candidate
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                  Party
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider">
                  Votes
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, j) => {
                const isThem =
                  row.isCandidate ||
                  row.name.toLowerCase() === candidateName.toLowerCase();
                return (
                  <tr
                    key={`${row.rank}-${j}`}
                    className={`border-b border-gray-50 last:border-0 ${
                      isThem ? "bg-[#A31621]/5 font-semibold" : ""
                    }`}
                  >
                    <td className="px-4 py-2 text-[#0D1B2A]/50">{row.rank}</td>
                    <td className="px-4 py-2 text-[#0D1B2A]">
                      {row.name}
                      {isThem && (
                        <span
                          aria-label="this candidate"
                          className="ml-2 inline-block rounded-full bg-[#A31621]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#A31621]"
                        >
                          this candidate
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[#0D1B2A]/60">
                      {row.party ?? "Independent"}
                    </td>
                    <td className="px-4 py-2 text-right text-[#0D1B2A]">
                      {row.votes !== null ? row.votes.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-[#0D1B2A]/70">
                      {row.percentage ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasFooter && (
        <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 bg-gray-50 px-5 py-3 [font-variant-numeric:tabular-nums]">
          {record.totalVotes !== null && (
            <span className="text-xs text-[#0D1B2A]/55">
              {record.totalVotes.toLocaleString()} votes cast
            </span>
          )}
          {record.registeredVoters !== null && (
            <span className="text-xs text-[#0D1B2A]/55">
              {record.registeredVoters.toLocaleString()} registered voters
            </span>
          )}
          {record.turnout && (
            <span className="text-xs font-semibold text-[#0D1B2A]/70">
              {record.turnout} turnout
            </span>
          )}
          {record.sources && record.sources.length > 0 && (
            <a
              href={record.sources[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs font-medium text-[#A31621] transition-colors hover:underline"
            >
              Source ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ResultBadge({ result }: { result: ElectionRecord["result"] }) {
  const styles =
    result === "elected"
      ? "bg-[#1A6B3A]/10 text-[#1A6B3A]"
      : result === "not_elected"
        ? "bg-gray-100 text-[#0D1B2A]/60"
        : result === "withdrew"
          ? "bg-amber-50 text-amber-700"
          : "bg-gray-50 text-gray-500";
  const label =
    result === "elected"
      ? "✓ Elected"
      : result === "not_elected"
        ? "Not elected"
        : result === "withdrew"
          ? "Withdrew"
          : "Unknown";
  return (
    <span
      className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${styles}`}
    >
      {label}
    </span>
  );
}
