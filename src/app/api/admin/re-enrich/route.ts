import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { runRepoScript } from "@/lib/admin-exec";
import { requireAdmin } from "@/lib/admin-guard";
import { mergeCronState } from "@/lib/admin-cron-state";

export const runtime = "nodejs";
export const maxDuration = 600;

const Body = z.object({
  candidateId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { candidateId } = parsed.data;
  const [row] = await db
    .select({ slug: candidates.slug })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const outcome = await runRepoScript("scripts/enrich.ts", [
    `--candidate-slug=${row.slug}`,
  ]);

  const now = new Date().toISOString();
  mergeCronState({
    lastEnrichment: now,
    lastEnrichmentResult: outcome.ok ? "success" : "fail",
  });

  return NextResponse.json({
    ok: outcome.ok,
    durationSec: outcome.durationSec,
    outputTail: outcome.output.split("\n").slice(-40).join("\n"),
  });
}
