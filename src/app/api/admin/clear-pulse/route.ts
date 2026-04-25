import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { issueVotes, candidateRatings } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-guard";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await db.delete(issueVotes);
    await db.delete(candidateRatings);
    return NextResponse.json({ message: "Poll data cleared successfully." });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
