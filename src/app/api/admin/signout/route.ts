import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Sign out the current admin session and redirect to the login page.
 * Called via a plain <form method="POST" action="/api/admin/signout">.
 */
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
