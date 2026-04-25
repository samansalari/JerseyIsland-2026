import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topicUpvotes } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { createHash } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issue: string }> },
) {
  const { issue } = await params;

  // Build anonymous fingerprint — SHA256 of IP + UA + today's date
  // No PII stored: SHA256 output cannot be reversed
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const fingerprint = createHash("sha256")
    .update(`${ip}:${ua}:${today}:votepulse-upvote`)
    .digest("hex");

  try {
    await db
      .insert(topicUpvotes)
      .values({ issue, fingerprint })
      .onConflictDoNothing();

    const countRows = await db
      .select({ total: count() })
      .from(topicUpvotes)
      .where(eq(topicUpvotes.issue, issue));

    return NextResponse.json({ ok: true, total: Number(countRows[0]?.total ?? 0) });
  } catch (err) {
    console.error("[Upvote API]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ issue: string }> },
) {
  const { issue } = await params;

  try {
    const countRows = await db
      .select({ total: count() })
      .from(topicUpvotes)
      .where(eq(topicUpvotes.issue, issue));

    return NextResponse.json({ total: Number(countRows[0]?.total ?? 0) });
  } catch (err) {
    console.error("[Upvote GET API]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
