import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { env } from "@/lib/env";
import { JERSEY_RED_PRIMARY_HEX } from "@/lib/brand-metadata";
import { NavMobile } from "@/components/nav-mobile";
import { Logo } from "@/components/logo";

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "Home | VotePulse — Jersey 2026 Election",
    template: "%s | VotePulse — Jersey 2026 Election",
  },
  description:
    "Independent candidate, policy, and district tracking for Jersey's 2026 general election. Non-partisan. Sources cited.",
  icons: {
    icon: "/votepulse-icon.svg",
    shortcut: "/votepulse-icon.svg",
    apple: "/votepulse-icon.svg",
  },
  applicationName: "VotePulse",
  keywords: [
    "Jersey election",
    "Jersey 2026",
    "States Assembly",
    "Deputies",
    "Constables",
    "Senators",
    "candidates",
    "policy tracker",
    "VotePulse",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "VotePulse",
    locale: "en_GB",
    url: "/",
    title: "Home | VotePulse — Jersey 2026 Election",
    description:
      "Independent candidate, policy, and district tracking for Jersey's 2026 general election. Non-partisan. Sources cited.",
    images: [
      {
        url: "/votepulse-icon.svg",
        width: 1024,
        height: 1024,
        alt: "VotePulse — Jersey 2026 election intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Home | VotePulse — Jersey 2026 Election",
    description:
      "Independent candidate, policy, and district tracking for Jersey's 2026 general election.",
    images: ["/votepulse-icon.svg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: JERSEY_RED_PRIMARY_HEX,
  width: "device-width",
  initialScale: 1,
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/candidates", label: "Candidates" },
  { href: "/compare", label: "Compare" },
  { href: "/trends", label: "Trends" },
  { href: "/about", label: "About" },
] as const;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" className={archivo.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        {/* Top accent ribbon */}
        <div className="h-[3px] w-full bg-jersey-red" aria-hidden />

        {/* ── Header ────────────────────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-gold/20 bg-navy/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
            <Logo size="md" showWordmark href="/" />

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-md px-3 py-1.5 text-[13px] font-medium text-on-primary/75 transition-colors hover:bg-white/10 hover:text-on-primary"
                >
                  {label}
                </Link>
              ))}
            </nav>

            {/* Mobile hamburger — client component */}
            <NavMobile links={NAV_LINKS as unknown as { href: string; label: string }[]} />
          </div>
        </header>

        {/* ── Main content ──────────────────────────────── */}
        <div className="min-h-[calc(100vh-3.5rem-3px)]">{children}</div>

        {/* ── Footer ────────────────────────────────────── */}
        <footer className="border-t border-border bg-navy text-on-primary/70">
          <div className="mx-auto max-w-6xl px-5 py-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              {/* Brand column */}
              <div className="max-w-xs">
                <Logo size="sm" showWordmark href="/" />
                <p className="mt-3 text-[13px] leading-relaxed">
                  Independent election intelligence for Jersey&rsquo;s 2026
                  general election. Non-partisan. Open source. Sources cited.
                </p>
              </div>

              {/* Link columns */}
              <div className="flex gap-16 text-[13px]">
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-on-primary/40">
                    Navigate
                  </p>
                  <ul className="space-y-2">
                    {NAV_LINKS.map(({ href, label }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className="transition-colors hover:text-on-primary"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-on-primary/40">
                    Sources
                  </p>
                  <ul className="space-y-2">
                    <li>
                      <a
                        href="https://flow.je"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-on-primary"
                      >
                        flow.je
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://vote.je"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-on-primary"
                      >
                        vote.je
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://policy.je"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-on-primary"
                      >
                        policy.je
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-10 border-t border-on-primary/10 pt-6">
              <p className="text-[12px] leading-relaxed text-on-primary/40">
                VotePulse is an independent project. AI-generated summaries may
                contain errors. Always verify with original sources. Not
                affiliated with the States of Jersey or any political party.
              </p>
              <p className="mt-2 text-[11px] text-on-primary/25">
                &copy; {new Date().getFullYear()} VotePulse &middot; Jersey 2026
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
