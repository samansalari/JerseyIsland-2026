import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await db
    .selectDistinct({ district: candidates.district })
    .from(candidates)
    .orderBy(asc(candidates.district));

  const districts = result
    .map((row) => row.district)
    .filter((district): district is string => Boolean(district && district !== "Unknown"));

  return NextResponse.json({ districts });
}
