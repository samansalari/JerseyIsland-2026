import { NextRequest, NextResponse } from "next/server";
import { runRepoScript } from "@/lib/admin-exec";
import { requireAdmin } from "@/lib/admin-guard";
import { mergeCronState } from "@/lib/admin-cron-state";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const outcome = await runRepoScript("scripts/enrich.ts", ["--batch"]);
  const now = new Date().toISOString();
  mergeCronState({
    lastEnrichment: now,
    lastEnrichmentResult: outcome.ok ? "success" : "fail",
  });

  return NextResponse.json({
    ok: outcome.ok,
    message: outcome.ok
      ? "Batch enrichment completed."
      : "Batch enrichment failed — check logs.",
    outputTail: outcome.output.split("\n").slice(-40).join("\n"),
  });
}
