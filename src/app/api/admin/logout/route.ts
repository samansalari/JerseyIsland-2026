import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // AdminNav client component fetches this and then does window.location.href = '/admin/login'
  return NextResponse.json({ ok: true });
}
