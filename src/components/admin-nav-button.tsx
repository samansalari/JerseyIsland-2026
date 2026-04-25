import { createClient } from "@/lib/supabase/server";

/**
 * Server component — safe to call createClient() here.
 * Renders only when the current user is authenticated.
 * Import this in layout.tsx and pass it as a prop to <Navbar>.
 */
export async function AdminNavButton() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;
  } catch {
    // Supabase not configured — no admin button
    return null;
  }

  return (
    <a
      href="/admin"
      className="inline-flex items-center gap-1.5 rounded-full bg-[#A31621] px-3 py-1.5 text-xs font-semibold text-[#F5E8C8] transition-colors hover:bg-[#6B1414]"
    >
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      Admin
    </a>
  );
}
