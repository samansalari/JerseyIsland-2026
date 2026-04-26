import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseUrl,
  getSupabasePublicKey,
  isSupabaseConfigured,
} from "@/utils/supabase/env";

/**
 * Magic-link callback route.
 *
 * Supabase redirects here after the user clicks the sign-in link in their
 * email. The URL contains a one-time `code` (PKCE flow). This route
 * exchanges it for a session, writes the session cookie, then sends the
 * user to /admin.
 *
 * Must be listed in Supabase → Authentication → Redirect URLs:
 *   https://votepulse.je/admin/auth/callback
 *   http://localhost:3000/admin/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  // Allow an optional `next` override (not currently sent, but good practice)
  const next =
    searchParams.get("next") ??
    searchParams.get("redirectTo") ??
    "/admin";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${origin}/admin/login?error=Supabase+is+not+configured`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/admin/login?error=Invalid+link.+Please+request+a+new+one.`,
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // May be called from a Server Component context — safe to ignore
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    // Ensure `next` only redirects to internal paths
    const destination = next.startsWith("/") ? next : "/admin";
    return NextResponse.redirect(`${origin}${destination}`);
  }

  console.error("[admin/auth/callback] exchangeCodeForSession error:", error.message);

  return NextResponse.redirect(
    `${origin}/admin/login?error=Could+not+authenticate.+Please+request+a+new+link.`,
  );
}
