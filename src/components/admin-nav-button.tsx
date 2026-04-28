"use client";

import { useEffect, useState } from "react";

/**
 * Client component so public static pages never read auth cookies during SSR.
 * Renders only when the current browser session is authenticated.
 */
export function AdminNavButton() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const res = await fetch("/api/admin/health", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (mounted) setIsAdmin(res.ok);
      } catch {
        if (mounted) setIsAdmin(false);
      }
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (!isAdmin) return null;

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
