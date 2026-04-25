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
  const title = `${district} candidates — Jersey 2026 | VotePulse`;
  const description = `All candidates standing in ${district} for Jersey's 2026 general election. Compare their positions on housing, healthcare, tax, and more.`;
  const canonical = `${base}/districts/${districtParam}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "VotePulse",
      locale: "en_GB",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical },
    robots: { index: true, follow: true },
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
