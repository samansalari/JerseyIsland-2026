import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyAdminCookie } from "@/lib/admin-auth";

export async function requireAdmin(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!env.ADMIN_SECRET) {
    return NextResponse.json(
      { error: "ADMIN_SECRET is not set on the server." },
      { status: 503 },
    );
  }
  if (!(await verifyAdminCookie(env.ADMIN_SECRET, request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
