import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  getSupabasePublicKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/utils/supabase/env";

/**
 * Refreshes the Supabase auth session and returns a `NextResponse` that may
 * carry updated auth cookies. Call from root `middleware.ts` before other logic.
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublicKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Triggers refresh; do not add logic between createServerClient and getUser().
  await supabase.auth.getUser();

  return supabaseResponse;
}

/** Copy cookies set during session refresh onto another response (e.g. redirect). */
export function forwardSessionCookies(
  from: NextResponse,
  onto: NextResponse,
): NextResponse {
  from.cookies.getAll().forEach((c) => {
    onto.cookies.set(c.name, c.value);
  });
  return onto;
}
