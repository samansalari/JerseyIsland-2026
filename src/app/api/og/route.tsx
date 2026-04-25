import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title =
    searchParams.get("title") || "Jersey 2026 Election Intelligence";
  const sub =
    searchParams.get("sub") || "135 Candidates · 14 Districts · 7 June 2026";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          backgroundColor: "#0D1B2A",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Red accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            backgroundColor: "#A31621",
            display: "flex",
          }}
        />

        {/* Logo wordmark */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#F5E8C8",
            marginBottom: 28,
            display: "flex",
            letterSpacing: "-1px",
          }}
        >
          <span>Vote</span>
          <span style={{ color: "#C8922A" }}>Pulse</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 36,
            color: "rgba(245,232,200,0.92)",
            textAlign: "center",
            marginBottom: 24,
            maxWidth: "940px",
            display: "flex",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>

        {/* Sub pill */}
        <div
          style={{
            fontSize: 20,
            color: "#C8922A",
            padding: "10px 28px",
            border: "1px solid rgba(200,146,42,0.4)",
            borderRadius: "8px",
            display: "flex",
          }}
        >
          {sub}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            fontSize: 14,
            color: "rgba(245,232,200,0.3)",
            display: "flex",
          }}
        >
          Independent · Non-partisan · votepulse.je
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
