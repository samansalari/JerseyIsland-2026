import { NextRequest, NextResponse } from "next/server";
import { generatePulseInsight } from "@/lib/pulse-insight";
import { requireAdmin } from "@/lib/admin-guard";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await generatePulseInsight();
    return NextResponse.json({ message: "Insight regenerated" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
