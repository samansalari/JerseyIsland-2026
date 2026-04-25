import type { Metadata } from "next";
import { asc } from "drizzle-orm";
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
  const description = `All candidates standing in ${district} for Jersey's 2026 general election. Compare their positions on housing, healthcare, tax, environment, and more.`;
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
    .orderBy(asc(candidates.district));

  const districtList = allDistricts
    .map((row) => row.district)
    .filter((value): value is string => Boolean(value && value !== "Unknown"));

  if (!districtList.includes(district)) notFound();

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <DistrictTable initialDistrict={district} allDistricts={districtList} />
    </div>
  );
}
