import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicKey, getSupabaseUrl, isSupabaseConfigured } from "@/utils/supabase/env";

/**
 * Refreshes the Supabase auth session AND enforces /admin/* route protection.
 * Call from root middleware.ts only.
 *
 * Security model:
 * - Unauthenticated → /admin/* redirects to /admin/login
 * - Already authenticated → /admin/login redirects to /admin
 * - All other routes: session cookies refreshed, pass through
 */
export async function updateSession(request: NextRequest) {
  // The magic-link callback must be reachable before a session exists
  const isCallback =
    request.nextUrl.pathname === "/admin/auth/callback";

  if (!isSupabaseConfigured()) {
    // If Supabase is not configured, block admin routes (except callback/login)
    if (
      request.nextUrl.pathname.startsWith("/admin") &&
      !request.nextUrl.pathname.startsWith("/admin/login") &&
      !isCallback
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("error", "config");
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // Let the callback route through — it handles its own auth exchange
  if (isCallback) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublicKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // CRITICAL: Do NOT add any logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated user accessing admin pages → redirect to login
  if (
    !user &&
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login") &&
    pathname !== "/admin/auth/callback"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("redirectTo", pathname);
    const redirect = NextResponse.redirect(url);
    // Forward refreshed session cookies onto the redirect
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => redirect.cookies.set(c.name, c.value));
    return redirect;
  }

  // Authenticated user visiting login → send to dashboard
  if (user && pathname.startsWith("/admin/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => redirect.cookies.set(c.name, c.value));
    return redirect;
  }

  // Unauthenticated request to /api/admin/* → 401
  if (!user && pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return supabaseResponse;
}
