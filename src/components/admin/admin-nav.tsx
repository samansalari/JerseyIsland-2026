"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/candidates", label: "Candidates", icon: "👤" },
  { href: "/admin/pulse", label: "Public Pulse", icon: "🗳️" },
  { href: "/admin/scrapers", label: "Scrapers", icon: "🔄" },
  { href: "/admin/enrichment", label: "AI Enrichment", icon: "🤖" },
];

async function logout() {
  await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
  window.location.href = "/admin/login";
}

export function AdminNav() {
  const pathname = usePathname();

  // Don't render nav on login page
  if (pathname === "/admin/login") return null;

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 flex flex-col z-40"
      style={{
        backgroundColor: "#0D1B2A",
        borderRight: "1px solid rgba(245,232,200,0.08)",
      }}
    >
      {/* Header */}
      <div
        className="p-6 border-b"
        style={{ borderColor: "rgba(245,232,200,0.08)" }}
      >
        <p className="font-bold text-sm">
          <span style={{ color: "#F5E8C8" }}>Vote</span>
          <span style={{ color: "#C8922A" }}>Pulse</span>
          <span
            className="ml-2 text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(163,22,33,0.3)",
              color: "#F5E8C8",
            }}
          >
            Admin
          </span>
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: "rgba(245,232,200,0.35)" }}
        >
          Jersey 2026 Election
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: isActive
                  ? "rgba(245,232,200,0.1)"
                  : "transparent",
                color: isActive ? "#F5E8C8" : "rgba(245,232,200,0.5)",
                borderLeft: isActive
                  ? "2px solid #C8922A"
                  : "2px solid transparent",
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div
        className="p-4 border-t"
        style={{ borderColor: "rgba(245,232,200,0.08)" }}
      >
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs mb-1 transition-all hover:opacity-80"
          style={{ color: "rgba(245,232,200,0.35)" }}
        >
          <span>🌐</span>
          View public site
        </Link>
        <button
          onClick={() => void logout()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all hover:opacity-80"
          style={{ color: "rgba(245,232,200,0.4)" }}
        >
          <span>🚪</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
