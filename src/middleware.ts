import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // CVE-2025-29927 mitigation: block internal subrequest bypass header
  if (request.headers.get("x-middleware-subrequest")) {
    return new Response(null, { status: 403 });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run middleware on all routes EXCEPT:
     * - Next.js internals (_next/static, _next/image)
     * - Static asset file extensions (images, fonts, icons)
     * - Well-known crawl files (robots.txt, sitemap.xml, llms.txt)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|llms.*\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$).*)",
  ],
};
