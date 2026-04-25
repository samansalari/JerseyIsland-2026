import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";

export const revalidate = 300; // 5 minutes

export default async function DistrictsPage() {
  const result = await db
    .select({
      district: candidates.district,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(candidates)
    .groupBy(candidates.district)
    .orderBy(asc(candidates.district));

  const districts = result.filter(
    (row) => row.district && row.district !== "Unknown",
  );

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold text-[#0D1B2A]">Districts</h1>
        <p className="mb-8 mt-2 text-sm text-gray-500">
          Select a district to see all candidates and their positions side by side.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {districts.map((district) => (
            <Link
              key={district.district}
              href={`/districts/${encodeURIComponent(district.district)}`}
              className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-[#A31621] hover:shadow-sm active:scale-[0.96]"
            >
              <div>
                <div className="font-semibold text-[#0D1B2A] transition-colors group-hover:text-[#A31621]">
                  {district.district}
                </div>
                <div className="mt-0.5 text-xs text-gray-400">
                  {district.count} candidate{district.count !== 1 ? "s" : ""}
                </div>
              </div>
              <svg
                className="h-4 w-4 text-gray-300 group-hover:text-[#A31621]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
