import { NextResponse } from "next/server";
import { clearAdminAuthCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearAdminAuthCookie(res);
  return res;
}
