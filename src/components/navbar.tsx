"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/candidates", label: "Candidates" },
  { href: "/districts", label: "Districts" },
  { href: "/compare", label: "Compare" },
  { href: "/trends", label: "Trends" },
  { href: "/about", label: "About" },
] as const;

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full border-b backdrop-blur-sm"
        style={{
          backgroundColor: "rgba(245, 245, 240, 0.95)",
          borderColor: "rgba(13, 27, 42, 0.1)",
        }}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/Logo__2_.png"
              alt="VotePulse"
              width={36}
              height={36}
              className="rounded-lg mix-blend-multiply"
              priority
            />
            <span
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: "var(--font-archivo), Archivo, sans-serif" }}
            >
              <span style={{ color: "#0D1B2A" }}>Vote</span>
              <span style={{ color: "#C8922A" }}>Pulse</span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Main"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  fontFamily: "var(--font-archivo), Archivo, sans-serif",
                  color: pathname === link.href ? "#A31621" : "#0D1B2A",
                  backgroundColor:
                    pathname === link.href
                      ? "rgba(163, 22, 33, 0.08)"
                      : "transparent",
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg md:hidden"
            style={{ color: "#0D1B2A" }}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
          >
            <span
              className="block h-0.5 w-5 rounded-full"
              style={{ backgroundColor: "#0D1B2A" }}
            />
            <span
              className="block h-0.5 w-5 rounded-full"
              style={{ backgroundColor: "#0D1B2A" }}
            />
            <span
              className="block h-0.5 w-3.5 rounded-full"
              style={{ backgroundColor: "#0D1B2A" }}
            />
          </button>
        </div>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[100] md:hidden"
          style={{ backgroundColor: "rgba(13, 27, 42, 0.6)" }}
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <div
        id="mobile-nav-drawer"
        className={`fixed right-0 top-0 z-[110] flex h-full flex-col transition-transform duration-300 ease-in-out md:hidden ${
          menuOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
        style={{
          width: "min(280px, 80vw)",
          backgroundColor: "#F5F5F0",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.2)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!menuOpen}
      >
        <div
          className="flex flex-shrink-0 items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "rgba(13, 27, 42, 0.08)" }}
        >
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2"
          >
            <Image
              src="/Logo__2_.png"
              alt="VotePulse"
              width={28}
              height={28}
              className="rounded-md mix-blend-multiply"
            />
            <span
              className="text-sm font-bold"
              style={{
                fontFamily: "var(--font-archivo), Archivo, sans-serif",
              }}
            >
              <span style={{ color: "#0D1B2A" }}>Vote</span>
              <span style={{ color: "#C8922A" }}>Pulse</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "#0D1B2A" }}
            aria-label="Close menu"
          >
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <nav
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4"
          aria-label="Main"
        >
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all"
                style={{
                  fontFamily: "var(--font-archivo), Archivo, sans-serif",
                  color: isActive ? "#A31621" : "#0D1B2A",
                  backgroundColor: isActive
                    ? "rgba(163, 22, 33, 0.07)"
                    : "transparent",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <span
                  className="h-4 w-1 flex-shrink-0 rounded-full transition-all"
                  style={{
                    backgroundColor: isActive ? "#A31621" : "transparent",
                  }}
                  aria-hidden
                />
                {link.label}
                {!isActive && (
                  <svg
                    className="ml-auto opacity-20"
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </Link>
            );
          })}
        </nav>

        <div
          className="flex-shrink-0 border-t px-5 py-4"
          style={{ borderColor: "rgba(13, 27, 42, 0.08)" }}
        >
          <div
            className="mb-3 flex items-center gap-2 rounded-xl p-3"
            style={{ backgroundColor: "rgba(163, 22, 33, 0.06)" }}
          >
            <span className="text-base" aria-hidden>
              🗳️
            </span>
            <div>
              <p
                className="text-xs font-semibold"
                style={{
                  color: "#A31621",
                  fontFamily: "var(--font-archivo), Archivo, sans-serif",
                }}
              >
                Jersey Election 2026
              </p>
              <p
                className="text-xs"
                style={{
                  color: "rgba(13, 27, 42, 0.5)",
                  fontFamily: "var(--font-archivo), Archivo, sans-serif",
                }}
              >
                7 June 2026 · Polls open 8 AM
              </p>
            </div>
          </div>

          <p
            className="text-xs"
            style={{
              fontFamily: "var(--font-archivo), Archivo, sans-serif",
              color: "rgba(13, 27, 42, 0.35)",
            }}
          >
            Independent · Non-partisan · Not affiliated with the States of
            Jersey
          </p>
        </div>
      </div>
    </>
  );
}
