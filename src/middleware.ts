import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminCookie } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import {
  forwardSessionCookies,
  updateSession,
} from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      if (
        env.ADMIN_SECRET &&
        (await verifyAdminCookie(env.ADMIN_SECRET, request)) &&
        !request.nextUrl.searchParams.has("force")
      ) {
        return forwardSessionCookies(
          sessionResponse,
          NextResponse.redirect(new URL("/admin", request.url)),
        );
      }
      return sessionResponse;
    }

    if (!env.ADMIN_SECRET) {
      return forwardSessionCookies(
        sessionResponse,
        NextResponse.redirect(
          new URL("/admin/login?error=config", request.url),
        ),
      );
    }
    if (!(await verifyAdminCookie(env.ADMIN_SECRET, request))) {
      return forwardSessionCookies(
        sessionResponse,
        NextResponse.redirect(new URL("/admin/login", request.url)),
      );
    }
    return sessionResponse;
  }

  if (pathname.startsWith("/api/admin")) {
    if (pathname === "/api/admin/login" && request.method === "POST") {
      return sessionResponse;
    }
    if (!env.ADMIN_SECRET) {
      const res = NextResponse.json(
        { error: "ADMIN_SECRET not configured" },
        { status: 503 },
      );
      return forwardSessionCookies(sessionResponse, res);
    }
    if (!(await verifyAdminCookie(env.ADMIN_SECRET, request))) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return forwardSessionCookies(sessionResponse, res);
    }
    return sessionResponse;
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    /*
     * Run Supabase session refresh on all non-static routes; keep admin matcher
     * behaviour by handling `/admin` and `/api/admin` above.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
