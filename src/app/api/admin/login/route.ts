import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { setAdminAuthCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!env.ADMIN_SECRET) {
    return NextResponse.json(
      { error: "ADMIN_SECRET not configured" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const password =
    body && typeof body === "object" && "password" in body
      ? String((body as { password?: string }).password ?? "")
      : "";

  if (password !== env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  await setAdminAuthCookie(res, env.ADMIN_SECRET);
  return res;
}
