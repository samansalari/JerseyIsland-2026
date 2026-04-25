import { NextResponse } from "next/server";

// Login is now handled by the server action in app/admin/login/actions.ts.
// This route is no longer used.
export function POST() {
  return NextResponse.json(
    { error: "Use the /admin/login page to sign in." },
    { status: 410 },
  );
}
