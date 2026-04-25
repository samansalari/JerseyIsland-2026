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
    return NextResponse.json({
      message:
        "Poll votes and ratings cleared. The Public Pulse text insight is refreshed on the 6-hour schedule or via Regenerate insight in admin.",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
