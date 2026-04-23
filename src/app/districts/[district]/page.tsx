import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { DistrictTable } from "@/components/district-table";

export const dynamic = "force-dynamic";

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

export default async function DistrictPage({
  params,
}: {
  params: Promise<{ district: string }>;
}) {
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
