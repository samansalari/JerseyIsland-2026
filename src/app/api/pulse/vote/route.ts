import { createHash } from "crypto";
import { and, eq, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { issueVotes } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBody, voteSchema } from "@/lib/validate";

const VOTE_COOKIE = "vp_voted";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function fingerprintFrom(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  return createHash("sha256").update(`${ip}:${ua}`).digest("hex");
}

function setVoteCookie(res: NextResponse) {
  res.cookies.set(VOTE_COOKIE, "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(VOTE_COOKIE);
  return NextResponse.json({ hasVoted: cookie?.value === "true" });
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, 5, 60);
  if (!rl.success && rl.response) return rl.response;

  try {
    const body = await req.json().catch(() => ({}));
    const validated = validateBody(voteSchema, body);
    if ("error" in validated) return validated.error;
    const { issue } = validated.data;

    const existingCookie = req.cookies.get(VOTE_COOKIE);
    if (existingCookie?.value === "true") {
      return NextResponse.json(
        { error: "Already voted", alreadyVoted: true },
        { status: 409 },
      );
    }

    const fingerprint = fingerprintFrom(req);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentVote = await db
      .select({ id: issueVotes.id })
      .from(issueVotes)
      .where(
        and(
          eq(issueVotes.voterFingerprint, fingerprint),
          gte(issueVotes.createdAt, yesterday),
        ),
      )
      .limit(1);

    if (recentVote.length > 0) {
      const res = NextResponse.json(
        { error: "Already voted", alreadyVoted: true },
        { status: 409 },
      );
      setVoteCookie(res);
      return res;
    }

    await db.insert(issueVotes).values({
      issue,
      voterFingerprint: fingerprint,
    });

    const res = NextResponse.json({ success: true });
    setVoteCookie(res);
    return res;
  } catch (e) {
    console.error("[pulse/vote]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
