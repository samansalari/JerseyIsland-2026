import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import { env } from "@/lib/env";
import { JERSEY_RED_PRIMARY_HEX } from "@/lib/brand-metadata";
import { Logo } from "@/components/logo";
import { Navbar } from "@/components/navbar";
import { AdminNavButton } from "@/components/admin-nav-button";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { SeenovateFooterCredit } from "@/components/seenovate-footer-credit";

const GOOGLE_TAG_ID = "G-4WZWNNE0LP";
const CLARITY_PROJECT_ID = "whg4c7n340";

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
    "VotePulse is Jersey's non-partisan election intelligence platform for the " +
    "2026 general election on 7 June 2026. Compare 135 candidates across 14 " +
    "districts. AI-generated manifesto summaries, policy positions on housing, " +
    "healthcare, and tax. Free. No ads.",
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
      "VotePulse is Jersey's non-partisan election intelligence platform for the 2026 general election on 7 June 2026. Compare 135 candidates across 14 districts. AI-generated manifesto summaries, policy positions on housing, healthcare, and tax. Free. No ads.",
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
      "VotePulse is Jersey's non-partisan election intelligence platform for the 2026 general election on 7 June 2026. Compare 135 candidates across 14 districts.",
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
  { href: "/trends", label: "Public Pulse" },
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "Voting Guide" },
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
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
          `}
        </Script>
      </head>
      <body className="min-h-screen w-full max-w-full bg-background font-sans text-foreground antialiased">
        {/* Top accent ribbon */}
        <div className="h-[3px] w-full bg-jersey-red" aria-hidden />

        <Navbar adminButton={<AdminNavButton />} />

        <main className="w-full min-h-[calc(100vh-4rem-3px)] overflow-x-clip">
          {children}
        </main>

        {/* ── Footer ────────────────────────────────────── */}
        <footer className="border-t border-border bg-navy">
          {/* Main grid */}
          <div className="mx-auto max-w-6xl px-5 py-16">
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
                {/* ✓ WCAG — text-on-primary/75 on navy ≈ 10:1 (was inherited /70 — bumped) */}
                <p className="mt-3 text-[13px] leading-relaxed text-on-primary/75">
                  Independent election intelligence for Jersey&rsquo;s 2026
                  general election. Non-partisan. Sources cited.
                </p>
              </div>

              {/* Link columns */}
              <div className="flex gap-16 text-[13px]">
                <div>
                  {/* ✓ WCAG — text-on-primary/60 on navy ≈ 6:1 (was /40 = 3.36:1 — FIXED) */}
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-on-primary/60">
                    Navigate
                  </p>
                  <ul className="space-y-2">
                    {FOOTER_NAV_LINKS.map(({ href, label }) => (
                      <li key={href}>
                        {/* ✓ WCAG — text-on-primary/85 on navy ≈ 12:1 */}
                        <Link
                          href={href}
                          className="rounded-sm text-on-primary/85 transition-colors hover:text-on-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-navy"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  {/* ✓ WCAG — text-on-primary/60 on navy ≈ 6:1 (was /40 — FIXED) */}
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-on-primary/60">
                    Sources
                  </p>
                  <ul className="space-y-2">
                    <li>
                      <a
                        href="https://flow.je"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-sm text-on-primary/85 transition-colors hover:text-on-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-navy"
                      >
                        flow.je
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://vote.je"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-sm text-on-primary/85 transition-colors hover:text-on-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-navy"
                      >
                        vote.je
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://policy.je"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-sm text-on-primary/85 transition-colors hover:text-on-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-navy"
                      >
                        policy.je
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-on-primary/10" />

          {/* Bottom bar */}
          <div className="mx-auto max-w-6xl px-5 py-6">
            {/* ✓ WCAG — text-on-primary/60 on navy ≈ 6:1 (was /40 — FIXED) */}
            <p className="text-[12px] leading-relaxed text-on-primary/60">
              VotePulse is an independent project. AI-generated summaries may
              contain errors. Always verify with original sources. Not
              affiliated with the States of Jersey or any political party.
            </p>
            {/* ✓ WCAG — text-on-primary/55 on navy ≈ 4.8:1 (was /25 ≈ 1.5:1 — FIXED) */}
            <p className="mt-2 text-[11px] text-on-primary/55">
              &copy; {new Date().getFullYear()} VotePulse &middot; Jersey 2026
            </p>
            <SeenovateFooterCredit />
          </div>
        </footer>
        <PWAInstallButton />
      </body>
    </html>
  );
}
