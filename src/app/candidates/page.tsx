import type { Metadata } from "next";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { and, asc, count, isNotNull, ne, notLike, sql } from "drizzle-orm";
import { CandidateGrid } from "./candidate-grid";
import { buildPublicPageMetadata } from "@/lib/seo";

export const revalidate = 21600; // 6 hours

export const metadata: Metadata = buildPublicPageMetadata({
  titleSegment: "All 135 Candidates — Jersey 2026 General Election",
  description:
    "Jersey's 2026 general election (7 June 2026) has 135 declared candidates " +
    "standing across 14 districts. Browse AI-generated manifesto summaries, " +
    "compare policy positions on housing, healthcare, tax, and more. " +
    "Non-partisan. Free.",
  path: "/candidates",
});

/** Subset of candidate fields the listing page needs. */
export type CandidateCard = {
  slug: string;
  name: string;
  district: string;
  party: string | null;
  photoUrl: string | null;
  aiSummary: string | null;
};

async function getCandidates(): Promise<CandidateCard[]> {
  try {
    return await db
      .select({
        slug: candidates.slug,
        name: candidates.name,
        district: candidates.district,
        party: candidates.party,
        photoUrl: candidates.photoUrl,
        aiSummary: candidates.aiSummary,
      })
      .from(candidates)
      .orderBy(asc(candidates.name));
  } catch {
    return [];
  }
}

export default async function CandidatesPage() {
  const all = await getCandidates();

  // ── AEO aggregate queries ──────────────────────────────────────────────────
  const REAL_JERSEY_DISTRICTS = new Set([
    "St Helier North",
    "St Helier Central",
    "St Helier South",
    "St Saviour",
    "St Brelade",
    "St Clement",
    "St Peter",
    "St Lawrence",
    "St Mary",
    "St Ouen",
    "St John",
    "Trinity",
    "Grouville",
    "St Martin",
    "Island-wide (Senator)",
  ]);

  const districtCounts = await db
    .select({
      district: candidates.district,
      total: count(),
      enriched: sql<number>`count(*) filter (where ${candidates.aiSummary} is not null)`,
    })
    .from(candidates)
    .where(
      and(
        ne(candidates.district, "Unknown"),
        notLike(candidates.district, "District %"),
      ),
    )
    .groupBy(candidates.district)
    .orderBy(candidates.district);

  // Secondary client-side guard for any other non-real names
  const validDistrictCounts = districtCounts.filter((d) =>
    REAL_JERSEY_DISTRICTS.has(d.district),
  );

  const enrichedCountRows = await db
    .select({ count: count() })
    .from(candidates)
    .where(isNotNull(candidates.aiSummary));

  const totalEnriched = enrichedCountRows[0]?.count ?? 0;

  const partyBreakdown = await db
    .select({
      party: candidates.party,
      count: count(),
    })
    .from(candidates)
    .where(ne(candidates.district, "Unknown"))
    .groupBy(candidates.party)
    .orderBy(sql`count(*) desc`);

  const independentCount = partyBreakdown
    .filter((p) => !p.party)
    .reduce((sum, p) => sum + Number(p.count), 0);

  // Derive filter options from the data.
  const districts = [...new Set(all.map((c) => c.district))].sort();
  const parties = [
    ...new Set(all.map((c) => c.party).filter(Boolean) as string[]),
  ].sort();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://votepulse.je";

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-14">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-navy md:text-[34px]">
          Candidates
        </h1>
      </header>

      {/* ── AEO Answer Capsule ─────────────────────────────────────────── */}
      {/* Structured for Google AI Overview extraction. Static server HTML. */}
      <section
        id="aeo-answer-capsule"
        aria-label="Jersey 2026 election candidates overview"
        className="mt-6 mb-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        {/* Gold top accent */}
        <div className="h-1 bg-[#C8922A]" />

        <div className="px-6 py-6">
          <article>
            <h2 className="text-lg font-bold text-[#0D1B2A] mb-3">
              Jersey 2026 General Election — Candidates
            </h2>

            {/* LEAD PARAGRAPH: Direct answer to "who is standing in Jersey 2026?" */}
            <p
              id="aeo-lead"
              className="text-[#0D1B2A] leading-relaxed text-sm font-medium"
            >
              Jersey&apos;s 2026 general election, scheduled for{" "}
              <strong>7 June 2026</strong>, has{" "}
              <strong>{all.length > 0 ? all.length : 135} declared candidates</strong>{" "}
              standing across <strong>14 districts</strong> in the States of
              Jersey.{" "}
              {independentCount > 0 && (
                <>
                  <strong>{independentCount} candidates</strong> are standing as
                  Independents.{" "}
                </>
              )}
              VotePulse tracks AI-generated manifesto summaries and policy
              positions on 10 key issues for every declared candidate.
            </p>

            {/* ── Stats row ──────────────────────────────────────────────── */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  value: String(all.length > 0 ? all.length : 135),
                  label: "Declared candidates",
                  colour: "#A31621",
                },
                {
                  value: "14",
                  label: "Electoral districts",
                  colour: "#0D1B2A",
                },
                {
                  value: String(totalEnriched),
                  label: "AI summaries ready",
                  colour: "#1A6B3A",
                },
                {
                  value: "10",
                  label: "Issues tracked per candidate",
                  colour: "#C8922A",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#F5F5F0] text-center"
                >
                  <span
                    className="text-2xl font-bold leading-none"
                    style={{ color: stat.colour }}
                  >
                    {stat.value}
                  </span>
                  <span className="text-xs text-[#0D1B2A]/60 mt-1 leading-tight">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* ── District breakdown ────────────────────────────────────── */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-[#0D1B2A] mb-3">
                Candidates by district
              </h3>
              <ul
                id="aeo-district-list"
                className="grid grid-cols-1 sm:grid-cols-2 gap-1.5"
                role="list"
              >
                {validDistrictCounts.map((d) => (
                  <li key={d.district}>
                    <a
                      href={`/districts/${encodeURIComponent(d.district)}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#F5F5F0] hover:bg-[#0D1B2A] transition-colors group w-full"
                    >
                      <span className="font-medium text-[#0D1B2A] group-hover:text-[#F5E8C8] text-sm transition-colors">
                        {d.district}
                      </span>
                      <span className="text-[#0D1B2A]/50 group-hover:text-[#F5E8C8]/60 text-xs ml-2 tabular-nums transition-colors">
                        {d.total} candidate{Number(d.total) !== 1 ? "s" : ""}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Key issues tracked ────────────────────────────────────── */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-[#0D1B2A] mb-3">
                Policy issues tracked for every candidate
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  "Housing",
                  "Healthcare",
                  "Tax",
                  "Education",
                  "Environment",
                  "Transport",
                  "Cost of living",
                  "Immigration",
                  "Economy",
                  "Public services",
                ].map((issue) => (
                  <span
                    key={issue}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#0D1B2A] text-[#F5E8C8]"
                  >
                    {issue}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Source attribution ────────────────────────────────────── */}
            <p className="mt-5 text-xs text-[#0D1B2A]/45 leading-relaxed">
              Candidate data is drawn from publicly available manifesto pages.
              AI summaries are generated by VotePulse and labelled as
              AI-generated. Data refreshes every 6 hours. For official election
              information, visit{" "}
              <a
                href="https://www.vote.je"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#A31621] hover:underline"
              >
                vote.je
              </a>
              .
            </p>
          </article>
        </div>
      </section>

      {/* ── Speakable + ItemList JSON-LD ──────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Jersey 2026 General Election — All Candidates",
            url: `${siteUrl}/candidates`,
            speakable: {
              "@type": "SpeakableSpecification",
              cssSelector: ["#aeo-lead", "#aeo-district-list"],
            },
            mainEntity: {
              "@type": "ItemList",
              name: "Jersey 2026 Election Candidates",
              description:
                "All 135 candidates standing in Jersey's 2026 general election on 7 June 2026 across 14 districts.",
              numberOfItems: all.length > 0 ? all.length : 135,
              itemListElement: validDistrictCounts.map((d, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: `${d.district} — ${d.total} candidate${Number(d.total) !== 1 ? "s" : ""}`,
                url: `${siteUrl}/districts/${encodeURIComponent(d.district)}`,
              })),
            },
          }),
        }}
      />

      <CandidateGrid
        candidates={all}
        districts={districts}
        parties={parties}
      />
    </main>
  );
}
