import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/revalidate
 *
 * Triggers Next.js ISR revalidation for specified paths.
 * Protected by REVALIDATION_SECRET.
 *
 * Body: { secret: string, paths: string[] }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { secret, paths } = body as { secret?: string; paths?: string[] };

  const expected = process.env.REVALIDATION_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "REVALIDATION_SECRET not configured" },
      { status: 500 },
    );
  }

  if (secret !== expected) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json(
      { error: "paths must be a non-empty array" },
      { status: 400 },
    );
  }

  const revalidated: string[] = [];
  for (const path of paths) {
    if (typeof path === "string" && path.startsWith("/")) {
      revalidatePath(path);
      revalidated.push(path);
    }
  }

  return NextResponse.json({
    revalidated,
    now: new Date().toISOString(),
  });
}
