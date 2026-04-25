import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/admin-nav";

/**
 * Auth-checking layout for all protected admin pages.
 * The login page lives outside this route group and is NOT wrapped here.
 *
 * Security layer 2: Middleware already blocks unauthenticated access;
 * this provides defence-in-depth at the server component level.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: "#F5F5F0", fontFamily: "Archivo, sans-serif" }}
    >
      <AdminNav />
      <main className="flex-1 ml-64 p-8 min-h-screen">{children}</main>
    </div>
  );
}
