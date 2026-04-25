// Dynamic OG image generator for VotePulse candidate pages
// Uses next/og (Satori) — no headless browser, works on Railway Node runtime

import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { eq } from "drizzle-orm";

// CRITICAL: Do NOT set `export const runtime = 'edge'`
// Railway runs Node.js — edge runtime is not supported there.
// next/og works perfectly on Node runtime.
export const dynamic = "force-dynamic";

// OG image dimensions — Twitter/X, Facebook, LinkedIn all use 1200×630
const WIDTH = 1200;
const HEIGHT = 630;

// ── Font loader ──────────────────────────────────────────────────────────────
// Node.js runtime: read Archivo WOFF2 directly from @fontsource/archivo
// (installed as a project dependency). No network dependency, no cold-start
// latency. Results are cached at module level after first read.

let archivoFontData: ArrayBuffer | null = null;
let archivoBoldFontData: ArrayBuffer | null = null;

function readFontsourceFile(weight: number): ArrayBuffer | null {
  try {
    const filePath = path.join(
      process.cwd(),
      "node_modules",
      "@fontsource",
      "archivo",
      "files",
      `archivo-latin-${weight}-normal.woff`,
    );
    const buf = fs.readFileSync(filePath);
    // Convert Node.js Buffer to ArrayBuffer
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch (err) {
    console.warn(`[OG] Could not read @fontsource/archivo ${weight} woff2:`, err);
    return null;
  }
}

function loadFonts(): {
  regular: ArrayBuffer | null;
  bold: ArrayBuffer | null;
} {
  if (archivoFontData !== null && archivoBoldFontData !== null) {
    return { regular: archivoFontData, bold: archivoBoldFontData };
  }

  archivoFontData = readFontsourceFile(400);
  archivoBoldFontData = readFontsourceFile(700);

  if (!archivoFontData || !archivoBoldFontData) {
    console.warn("[OG] Archivo font(s) failed to load from @fontsource/archivo");
  }

  return { regular: archivoFontData, bold: archivoBoldFontData };
}

// ── Candidate data loader ────────────────────────────────────────────────────

interface CandidateOgData {
  name: string;
  district: string;
  party: string | null;
  aiSummary: string | null;
}

async function getCandidateForOg(
  slug: string,
): Promise<CandidateOgData | null> {
  try {
    const rows = await db
      .select({
        name: candidates.name,
        district: candidates.district,
        party: candidates.party,
        aiSummary: candidates.aiSummary,
      })
      .from(candidates)
      .where(eq(candidates.slug, slug))
      .limit(1);

    return rows[0] ?? null;
  } catch (err) {
    console.error("[OG] DB error for slug:", slug, err);
    return null;
  }
}

// ── Tagline helper ───────────────────────────────────────────────────────────

function getTagline(aiSummary: string | null): string {
  if (!aiSummary) return "Jersey 2026 General Election Candidate";
  const firstSentence = aiSummary.split(/[.!?]/)[0]?.trim() ?? aiSummary;
  return firstSentence.length > 110
    ? firstSentence.slice(0, 107) + "…"
    : firstSentence;
}

// ── VotePulse logo mark (inline SVG as JSX for Satori) ──────────────────────

function VotePulseIcon({ size = 56 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.19,
        backgroundColor: "#0D1B2A",
        border: "2px solid #C8922A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      <svg
        width={size * 0.7}
        height={size * 0.7}
        viewBox="250 350 520 400"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon
          points="250,355 360,355 510,505 510,655 365,655 250,540"
          fill="#F5E8C8"
        />
        <polygon
          points="600,355 760,355 760,540 700,540 610,735 470,735 470,625 545,625"
          fill="#F5E8C8"
        />
      </svg>
    </div>
  );
}

// ── Party badge colour helper ────────────────────────────────────────────────

function getPartyColour(party: string | null): {
  bg: string;
  text: string;
  border: string;
} {
  if (!party) {
    return {
      bg: "rgba(255,255,255,0.12)",
      text: "#F5E8C8",
      border: "rgba(255,255,255,0.2)",
    };
  }
  const p = party.toLowerCase();
  if (p.includes("reform")) {
    return { bg: "#A31621", text: "#F5E8C8", border: "#6B1414" };
  }
  if (p.includes("progress")) {
    return { bg: "#1A4B8C", text: "#ffffff", border: "#143a70" };
  }
  if (p.includes("alliance")) {
    return { bg: "#1A6B3A", text: "#ffffff", border: "#144d2a" };
  }
  return { bg: "#C8922A", text: "#0D1B2A", border: "#A87823" };
}

// ── CANDIDATE card layout ────────────────────────────────────────────────────

function CandidateOgCard({ candidate }: { candidate: CandidateOgData }) {
  const tagline = getTagline(candidate.aiSummary);
  const partyLabel = candidate.party || "Independent";
  const partyColour = getPartyColour(candidate.party);

  const initials = candidate.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: "#0D1B2A",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Archivo, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Gold diagonal accent — top right */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(200,146,42,0.15) 0%, transparent 70%)",
          display: "flex",
        }}
      />

      {/* Red accent — bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: -60,
          width: 350,
          height: 350,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(163,22,33,0.2) 0%, transparent 70%)",
          display: "flex",
        }}
      />

      {/* Subtle grid texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.025) 39px, rgba(255,255,255,0.025) 40px)",
          display: "flex",
        }}
      />

      {/* Top bar — VotePulse branding */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 36,
          paddingLeft: 56,
          paddingRight: 56,
          paddingBottom: 0,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <VotePulseIcon size={52} />
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#F5E8C8",
                letterSpacing: "-0.5px",
                lineHeight: 1,
              }}
            >
              Vote
            </span>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#C8922A",
                letterSpacing: "-0.5px",
                lineHeight: 1,
              }}
            >
              Pulse
            </span>
          </div>
        </div>

        {/* Non-partisan badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 18px",
            borderRadius: 100,
            border: "1px solid rgba(255,255,255,0.15)",
            backgroundColor: "rgba(255,255,255,0.07)",
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: "rgba(245,232,200,0.7)",
              letterSpacing: "0.03em",
              fontWeight: 400,
            }}
          >
            Jersey 2026 General Election
          </span>
        </div>
      </div>

      {/* Main candidate content */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          flex: 1,
          paddingLeft: 56,
          paddingRight: 56,
          paddingTop: 28,
          paddingBottom: 0,
          gap: 48,
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Avatar circle */}
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: "50%",
            backgroundColor: "#A31621",
            border: "4px solid #C8922A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: "#F5E8C8",
              lineHeight: 1,
            }}
          >
            {initials}
          </span>
        </div>

        {/* Name, district, party, tagline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 0,
          }}
        >
          <span
            style={{
              fontSize: candidate.name.length > 20 ? 54 : 64,
              fontWeight: 700,
              color: "#F5E8C8",
              lineHeight: 1.05,
              letterSpacing: "-1px",
            }}
          >
            {candidate.name}
          </span>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginTop: 16,
            }}
          >
            {/* District badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 16px",
                borderRadius: 100,
                backgroundColor: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <span style={{ fontSize: 15, color: "rgba(245,232,200,0.6)" }}>
                📍
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: "#F5E8C8",
                }}
              >
                {candidate.district}
              </span>
            </div>

            {/* Party badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "6px 16px",
                borderRadius: 100,
                backgroundColor: partyColour.bg,
                border: `1px solid ${partyColour.border}`,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: partyColour.text,
                }}
              >
                {partyLabel}
              </span>
            </div>
          </div>

          {tagline && (
            <span
              style={{
                fontSize: 20,
                fontWeight: 400,
                color: "rgba(245,232,200,0.6)",
                lineHeight: 1.45,
                marginTop: 20,
                maxWidth: 660,
              }}
            >
              {tagline}
            </span>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 56,
          paddingRight: 56,
          paddingTop: 20,
          paddingBottom: 28,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          marginTop: 20,
          position: "relative",
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: 16,
            color: "rgba(245,232,200,0.4)",
            fontWeight: 400,
          }}
        >
          votepulse.je/candidates/{"slug"}
        </span>
        <span
          style={{
            fontSize: 16,
            color: "#C8922A",
            fontWeight: 600,
          }}
        >
          Non-partisan · AI-powered · Free
        </span>
      </div>

      {/* Gold accent line at very top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          backgroundColor: "#C8922A",
          display: "flex",
        }}
      />
    </div>
  );
}

// ── FALLBACK card ────────────────────────────────────────────────────────────

function FallbackOgCard() {
  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: "#0D1B2A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Archivo, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Gold radial glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(200,146,42,0.12) 0%, transparent 65%)",
          display: "flex",
        }}
      />

      {/* Gold top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          backgroundColor: "#C8922A",
          display: "flex",
        }}
      />

      {/* Centred content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          position: "relative",
          zIndex: 10,
        }}
      >
        <VotePulseIcon size={96} />

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "baseline",
            gap: 0,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#F5E8C8",
              letterSpacing: "-2px",
              lineHeight: 1,
            }}
          >
            Vote
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#C8922A",
              letterSpacing: "-2px",
              lineHeight: 1,
            }}
          >
            Pulse
          </span>
        </div>

        <span
          style={{
            fontSize: 26,
            fontWeight: 400,
            color: "rgba(245,232,200,0.6)",
            letterSpacing: "0.01em",
          }}
        >
          Jersey 2026 Election Intelligence
        </span>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 8,
            marginTop: 8,
          }}
        >
          {["Non-partisan", "AI-powered", "Free"].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "8px 20px",
                borderRadius: 100,
                border: "1px solid rgba(200,146,42,0.35)",
                backgroundColor: "rgba(200,146,42,0.08)",
                display: "flex",
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  color: "#C8922A",
                  fontWeight: 500,
                }}
              >
                {tag}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom URL */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          display: "flex",
        }}
      >
        <span
          style={{
            fontSize: 16,
            color: "rgba(245,232,200,0.3)",
          }}
        >
          votepulse.je
        </span>
      </div>
    </div>
  );
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
): Promise<ImageResponse | Response> {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim() || null;
  const type = searchParams.get("type") || "candidate";

  const fonts = loadFonts();

  const fontOptions = [
    fonts.regular
      ? {
          name: "Archivo",
          data: fonts.regular,
          weight: 400 as const,
          style: "normal" as const,
        }
      : null,
    fonts.bold
      ? {
          name: "Archivo",
          data: fonts.bold,
          weight: 700 as const,
          style: "normal" as const,
        }
      : null,
  ].filter(Boolean) as {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700;
    style: "normal";
  }[];

  // Satori requires at least one font — provide a minimal fallback so the
  // render never errors even if Google Fonts is unreachable.
  if (fontOptions.length === 0) {
    console.warn("[OG] No fonts loaded; using empty fallback to avoid Satori crash");
  }

  // Fallback: no slug, or type=home
  if (!slug || type === "home") {
    return new ImageResponse(<FallbackOgCard />, {
      width: WIDTH,
      height: HEIGHT,
      fonts: fontOptions,
    });
  }

  // Candidate card
  const candidate = await getCandidateForOg(slug);

  if (!candidate) {
    return new ImageResponse(<FallbackOgCard />, {
      width: WIDTH,
      height: HEIGHT,
      fonts: fontOptions,
    });
  }

  return new ImageResponse(<CandidateOgCard candidate={candidate} />, {
    width: WIDTH,
    height: HEIGHT,
    fonts: fontOptions,
  });
}
