import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminCookie } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import {
  forwardSessionCookies,
  updateSession,
} from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // CVE-2025-29927 mitigation: block internal subrequest bypass header
  if (request.headers.get("x-middleware-subrequest")) {
    return new NextResponse(null, { status: 403 });
  }

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
     * Run middleware on all routes EXCEPT:
     * - Next.js internals (_next/static, _next/image)
     * - Static asset file extensions (images, fonts, icons)
     * - Well-known crawl files that must be served as plain text
     *   without any cookie/session processing (robots.txt, sitemap.xml, llms.txt)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|llms.*\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$).*)",
  ],
};
