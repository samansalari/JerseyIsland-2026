import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Admin — VotePulse" },
  robots: { index: false, follow: false },
};

/**
 * Minimal shell layout for the /admin segment.
 * - Protected pages (/admin, /admin/candidates, etc.) get their auth-checking
 *   layout from app/admin/(protected)/layout.tsx
 * - The login page (app/admin/login/page.tsx) is NOT in the protected group,
 *   so it is only wrapped by this minimal layout — no auth redirect loop.
 */
export default function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
