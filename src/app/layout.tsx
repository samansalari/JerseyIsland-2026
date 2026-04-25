import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import { env } from "@/lib/env";
import { JERSEY_RED_PRIMARY_HEX } from "@/lib/brand-metadata";
import { Logo } from "@/components/logo";
import { Navbar } from "@/components/navbar";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { SeenovateFooterCredit } from "@/components/seenovate-footer-credit";

const GOOGLE_TAG_ID = "G-4WZWNNE0LP";

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL || "https://votepulse.je"),
  title: {
    default: "VotePulse — Jersey 2026 Election Intelligence",
    template: "%s | VotePulse",
  },
  description:
    "Independent non-partisan election intelligence for Jersey's 2026 general election. 135 candidate profiles, AI-extracted policy positions, public opinion polls.",
  icons: {
    icon: [
      { url: "/favicons/votepulse_icon_navy.svg", type: "image/svg+xml" },
      { url: "/Logo__2_.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [{ url: "/Logo__2_.png", sizes: "1024x1024", type: "image/png" }],
    other: [{ rel: "icon", url: "/favicons/votepulse_icon_navy.svg" }],
  },
  manifest: "/favicons/site.webmanifest",
  applicationName: "VotePulse",
  keywords: [
    "Jersey election 2026",
    "Jersey candidates 2026",
    "States Assembly election",
    "Deputy election Jersey",
    "Senator Jersey 2026",
    "Connétable election",
    "Reform Jersey 2026",
    "vote Jersey",
    "Jersey election candidates",
    "Jersey politics 2026",
  ],
  authors: [{ name: "VotePulse", url: "https://votepulse.je" }],
  creator: "VotePulse",
  publisher: "VotePulse",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "VotePulse",
    locale: "en_GB",
    url: "/",
    title: "VotePulse — Jersey 2026 Election Intelligence",
    description:
      "Independent non-partisan election intelligence for Jersey's 2026 general election. 135 candidate profiles, AI-extracted policy positions, public opinion polls.",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "VotePulse — Jersey 2026 Election Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@votepulse_je",
    site: "@votepulse_je",
    title: "VotePulse — Jersey 2026 Election Intelligence",
    description:
      "Independent non-partisan election intelligence for Jersey's 2026 general election.",
    images: ["/api/og"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "geo.region": "JE",
    "geo.placename": "Jersey, Channel Islands",
    "geo.position": "49.2144;-2.1312",
    ICBM: "49.2144, -2.1312",
  },
  category: "politics",
};

export const viewport: Viewport = {
  themeColor: JERSEY_RED_PRIMARY_HEX,
  width: "device-width",
  initialScale: 1,
};

const FOOTER_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/candidates", label: "Candidates" },
  { href: "/districts", label: "Districts" },
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
    <html lang="en-GB" className={`${archivo.variable} h-full w-full max-w-full`}>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_TAG_ID}');
          `}
        </Script>
      </head>
      <body className="min-h-screen w-full max-w-full bg-background font-sans text-foreground antialiased">
        {/* Top accent ribbon */}
        <div className="h-[3px] w-full bg-jersey-red" aria-hidden />

        <Navbar />

        <main className="w-full min-h-[calc(100vh-4rem-3px)] overflow-x-clip">
          {children}
        </main>

        {/* ── Footer ────────────────────────────────────── */}
        <footer className="border-t border-border bg-navy text-on-primary/70">
          <div className="mx-auto max-w-6xl px-5 py-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              {/* Brand column */}
              <div className="max-w-xs">
                <Logo
                  size="sm"
                  showWordmark
                  href="/"
                  wordmarkTheme="light"
                  blendMode="lighten"
                />
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
                    {FOOTER_NAV_LINKS.map(({ href, label }) => (
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
              <SeenovateFooterCredit />
            </div>
          </div>
        </footer>
        <PWAInstallButton />
      </body>
    </html>
  );
}
