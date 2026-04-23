"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Mobile slide-out nav. Renders only on <md breakpoints.
 * Uses a portal-free approach: the overlay + drawer sit in the DOM always
 * but are visibility-toggled so there's no layout shift.
 */
export function NavMobile({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Close on Escape
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    },
    [open],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-[#0D1B2A] transition-colors hover:bg-[#0D1B2A]/5 hover:text-[#A31621]"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {open ? (
            <>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-[#0D1B2A]/15 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <nav
        className={`fixed right-0 top-0 z-50 flex h-full w-64 flex-col bg-surface shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Mobile navigation"
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-5">
          <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Menu
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-navy/5 hover:text-navy"
            aria-label="Close menu"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        <ul className="flex-1 space-y-1 px-3 py-4">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                aria-current={pathname === href ? "page" : undefined}
                className={`block rounded-md px-3 py-2.5 text-[15px] transition-colors ${
                  pathname === href
                    ? "font-semibold text-[#A31621]"
                    : "font-medium text-[#0D1B2A] hover:bg-[#0D1B2A]/5 hover:text-[#A31621]"
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="border-t border-border px-5 py-4">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Independent project. Not affiliated with the States of Jersey.
          </p>
        </div>
      </nav>
    </div>
  );
}
