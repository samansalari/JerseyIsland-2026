import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topicFeedback } from "@/db/schema";
import { createHash } from "crypto";

const VALID_TYPES = new Set(["agree", "disagree", "missing", "wrong"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issue: string }> },
) {
  const { issue } = await params;
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { feedbackType, content } = body as {
    feedbackType: string;
    content?: unknown;
  };

  if (!VALID_TYPES.has(feedbackType)) {
    return NextResponse.json(
      { error: "Invalid feedback type" },
      { status: 400 },
    );
  }

  const trimmedContent =
    typeof content === "string" ? content.trim().slice(0, 500) : null;

  // Fingerprint (no PII — SHA256 of IP + UA + hour + issue)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH (hourly rate limit)
  const fingerprint = createHash("sha256")
    .update(`${ip}:${ua}:${hour}:${issue}:votepulse-feedback`)
    .digest("hex");

  try {
    await db.insert(topicFeedback).values({
      issue,
      feedbackType,
      content: trimmedContent,
      fingerprint,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Feedback API]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
