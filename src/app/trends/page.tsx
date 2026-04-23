import type { Metadata } from "next";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { count, isNotNull, sql } from "drizzle-orm";
import { TrendsClient } from "./trends-client";
import { buildPublicPageMetadata } from "@/lib/seo";

export const revalidate = 3600; // 1 hour

export const metadata: Metadata = buildPublicPageMetadata({
  titleSegment: "Sentiment overview",
  description:
    "AI-estimated media sentiment for Jersey 2026 candidates from indexed news — not a poll; transparency tool with clear limitations explained on-page.",
  path: "/trends",
});

export type CandidateSentiment = {
  slug: string;
  name: string;
  district: string;
  party: string | null;
  articleCount: number;
  positive: number;
  neutral: number;
  negative: number;
};

export type OverallSentiment = {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
};

async function getTrendsData() {
  try {
  // Total enriched articles
  const [totalRow] = await db
    .select({ n: count() })
    .from(articles)
    .where(isNotNull(articles.aiSentiment));
  const totalArticles = totalRow?.n ?? 0;

  if (totalArticles < 10) {
    return { totalArticles, overall: null, candidates: [] };
  }

  // Overall sentiment
  const overallRows = await db
    .select({
      sentiment: articles.aiSentiment,
      n: count(),
    })
    .from(articles)
    .where(isNotNull(articles.aiSentiment))
    .groupBy(articles.aiSentiment);

  const overall: OverallSentiment = {
    total: totalArticles,
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  for (const row of overallRows) {
    if (row.sentiment === "positive") overall.positive = row.n;
    else if (row.sentiment === "negative") overall.negative = row.n;
    else overall.neutral += row.n; // neutral + mixed → neutral bucket
  }

  // Per-candidate: count articles mentioning each candidate by sentiment
  // We need to unnest the candidate_mentions array and join
  const perCandidate = await db.execute(sql`
    SELECT
      c.slug,
      c.name,
      c.district,
      c.party,
      COUNT(*) AS article_count,
      COUNT(*) FILTER (WHERE a.ai_sentiment = 'positive') AS positive,
      COUNT(*) FILTER (WHERE a.ai_sentiment = 'negative') AS negative,
      COUNT(*) FILTER (WHERE a.ai_sentiment IN ('neutral', 'mixed')) AS neutral
    FROM articles a,
         LATERAL unnest(a.candidate_mentions) AS mention_id
    JOIN candidates c ON c.id = mention_id
    WHERE a.ai_sentiment IS NOT NULL
    GROUP BY c.slug, c.name, c.district, c.party
    ORDER BY COUNT(*) DESC
  `);

  const candidateData: CandidateSentiment[] = [...perCandidate]
    .map(
      (row: Record<string, unknown>): CandidateSentiment => ({
        slug: String(row.slug),
        name: String(row.name),
        district: String(row.district),
        party: row.party == null ? null : String(row.party),
        articleCount: Number(row.article_count),
        positive: Number(row.positive),
        neutral: Number(row.neutral),
        negative: Number(row.negative),
      }),
    )
    .filter((c) => c.articleCount >= 3);

  return { totalArticles, overall, candidates: candidateData };
  } catch {
    return { totalArticles: 0, overall: null, candidates: [] };
  }
}

export default async function TrendsPage() {
  const data = await getTrendsData();

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 md:py-14">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-navy md:text-[34px]">
          Sentiment Overview
        </h1>
        <p className="mt-2 max-w-lg text-[14px] text-muted-foreground">
          AI-estimated sentiment from media coverage of Jersey&rsquo;s 2026
          election candidates.
        </p>
      </header>

      {data.totalArticles < 10 ? (
        <div className="mt-12 rounded-xl border border-border bg-white p-8 text-center">
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
          <p className="mt-4 text-[15px] font-semibold text-navy">
            Not enough data yet
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Sentiment tracking will appear once we&rsquo;ve collected enough
            media coverage. Currently {data.totalArticles} article
            {data.totalArticles !== 1 && "s"} indexed.
          </p>
        </div>
      ) : (
        <TrendsClient
          overall={data.overall!}
          candidates={data.candidates}
          totalArticles={data.totalArticles}
        />
      )}
    </main>
  );
}
