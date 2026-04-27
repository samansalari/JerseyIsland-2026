import type { Metadata } from "next";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { DistrictTable } from "@/components/district-table";
import { siteBase } from "@/lib/seo";

export const revalidate = 300; // 5 minutes

type Props = { params: Promise<{ district: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { district: districtParam } = await params;
  const district = decodeURIComponent(districtParam);
  const base = siteBase();
  const title = `${district} Candidates — Jersey 2026 Election | VotePulse`;
  const description = `${district} has candidates standing in Jersey's 2026 general election on 7 June 2026. Compare their AI-generated manifesto summaries and positions on housing, healthcare, tax, environment, and more on VotePulse.`;
  const canonical = `${base}/districts/${districtParam}`;
  const ogImage = `${base}/favicons/android-chrome-512x512.png`;

  return {
    title,
    description,
    keywords: [
      `${district} candidates 2026`,
      `${district} election Jersey`,
      `Jersey ${district} deputy candidates`,
      "Jersey election 2026",
      "States of Jersey",
    ],
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "VotePulse",
      locale: "en_GB",
      type: "website",
      images: [
        {
          url: ogImage,
          width: 512,
          height: 512,
          alt: `${district} — Jersey 2026 Election | VotePulse`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: { canonical },
    robots: { index: true, follow: true },
    other: {
      "article:section": "Jersey Districts",
      "article:tag": `Jersey 2026, ${district}`,
      "geo.region": "JE",
      "geo.placename": `${district}, Jersey, Channel Islands`,
      "geo.position": "49.2144;-2.1312",
      ICBM: "49.2144, -2.1312",
    },
  };
}

export async function generateStaticParams() {
  try {
    const districts = await db
      .selectDistinct({ district: candidates.district })
      .from(candidates)
      .where(eq(candidates.is2026, true))
      .orderBy(asc(candidates.district));

    return districts
      .filter((row) => row.district && row.district !== "Unknown")
      .map((row) => ({ district: encodeURIComponent(row.district) }));
  } catch {
    return [];
  }
}

export default async function DistrictPage({ params }: Props) {
  const { district: districtParam } = await params;
  const district = decodeURIComponent(districtParam);

  const allDistricts = await db
    .selectDistinct({ district: candidates.district })
    .from(candidates)
    .where(eq(candidates.is2026, true))
    .orderBy(asc(candidates.district));

  const districtList = allDistricts
    .map((row) => row.district)
    .filter((value): value is string => Boolean(value && value !== "Unknown"));

  if (!districtList.includes(district)) notFound();

  const districtStats = await db
    .select({
      total: count(),
      withSummary: sql<number>`count(*) filter (where ${candidates.aiSummary} is not null)`,
      parties: sql<string[]>`array_agg(distinct ${candidates.party}) filter (where ${candidates.party} is not null)`,
    })
    .from(candidates)
    .where(and(eq(candidates.district, district), eq(candidates.is2026, true)));

  const statsRow = districtStats[0];
  const partyList = (statsRow?.parties ?? []).filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* ── AEO District Answer Capsule ───────────────────────────────── */}
      <section
        id="aeo-district-answer"
        aria-label={`${district} district Jersey 2026 election candidates`}
        className="max-w-[1600px] mx-auto px-4 pt-8 mb-4"
      >
        <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="h-0.5 bg-[#C8922A]" />
          <div className="px-6 py-5">
            <h2 className="text-base font-bold text-[#0D1B2A] mb-2">
              {district} — Jersey 2026 Election Candidates
            </h2>
            <p
              id="aeo-district-lead"
              className="text-sm text-[#0D1B2A] leading-relaxed"
            >
              <strong>{statsRow?.total ?? 0} candidates</strong> are standing in{" "}
              <strong>{district}</strong> for Jersey&apos;s 2026 general
              election on <strong>7 June 2026</strong>.
              {(statsRow?.withSummary ?? 0) > 0 && (
                <>
                  {" "}
                  <strong>{statsRow!.withSummary}</strong> have AI-generated
                  manifesto summaries available on VotePulse.
                </>
              )}
              {partyList.length > 0 && (
                <>
                  {" "}
                  Party representation includes: {partyList.join(", ")}.
                </>
              )}
              {" "}
              Click any candidate row in the table below to expand their AI
              summary and manifesto positions.
            </p>

            <p className="mt-3 text-xs text-[#0D1B2A]/40">
              For official {district} election information, visit{" "}
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
          </div>
        </article>
      </section>

      <DistrictTable initialDistrict={district} allDistricts={districtList} />
    </div>
  );
}
