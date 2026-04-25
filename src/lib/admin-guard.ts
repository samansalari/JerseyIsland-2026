import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicKey, getSupabaseUrl } from "@/utils/supabase/env";

/**
 * Route-level admin guard for API routes.
 * Returns a 401 response if the request has no valid Supabase session.
 * Returns null if the user is authenticated (caller should proceed).
 *
 * The middleware already blocks unauthenticated /api/admin requests,
 * but this provides defence-in-depth at the route handler level.
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<NextResponse | null> {
  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublicKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Route handlers are read-only for cookies in this context
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
