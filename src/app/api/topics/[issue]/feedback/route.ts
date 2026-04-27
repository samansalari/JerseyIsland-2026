import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topicFeedback } from "@/db/schema";
import { createHash } from "crypto";
import { z } from "zod";

const VALID_FEEDBACK_TYPES = [
  "accurate",
  "inaccurate",
  "missing_data",
  "wrong_attribution",
] as const;

const VALID_ISSUES = new Set([
  "housing",
  "healthcare",
  "tax",
  "education",
  "environment",
  "transport",
  "cost_of_living",
  "immigration",
  "economy",
  "public_services",
]);

const FeedbackSchema = z.object({
  feedbackType: z.enum(VALID_FEEDBACK_TYPES),
  content: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issue: string }> },
) {
  const { issue } = await params;

  if (!VALID_ISSUES.has(issue)) {
    return NextResponse.json({ error: "Invalid issue" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = FeedbackSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { feedbackType, content } = parsed.data;
  const trimmedContent = content?.trim() ?? null;

  // Server-side fingerprint — no PII sent from client
  // Rate-limits to one submission per IP+UA+hour+issue combination
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
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
    // Return ok so duplicate submissions don't surface errors to users
    return NextResponse.json({ ok: true });
  }
}
