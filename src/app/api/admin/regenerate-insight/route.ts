import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pulseInsights } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-guard";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await db.delete(pulseInsights);
    return NextResponse.json({
      message: "Cached insights cleared. Next visit to /trends will regenerate.",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
