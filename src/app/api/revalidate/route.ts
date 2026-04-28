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
 * Optional: { secret?: string, revalidateAll?: boolean } with header
 * `x-revalidation-secret` instead of body.secret (used by daily-update-cycle).
 */
const DEFAULT_REVALIDATE_PATHS = [
  "/",
  "/candidates",
  "/compare",
] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const headerSecret = request.headers.get("x-revalidation-secret");
  const { secret: bodySecret, paths, revalidateAll } = body as {
    secret?: string;
    paths?: string[];
    revalidateAll?: boolean;
  };

  const secret = bodySecret ?? headerSecret ?? "";

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

  let pathsToRevalidate: string[];
  if (revalidateAll === true) {
    pathsToRevalidate = [...DEFAULT_REVALIDATE_PATHS];
  } else if (Array.isArray(paths) && paths.length > 0) {
    pathsToRevalidate = paths;
  } else {
    return NextResponse.json(
      { error: "paths must be a non-empty array, or set revalidateAll: true" },
      { status: 400 },
    );
  }

  const revalidated: string[] = [];
  for (const path of pathsToRevalidate) {
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
