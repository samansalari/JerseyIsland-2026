import { ImageResponse } from "next/og";

export const alt = "VotePulse — Jersey 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Edge avoids a Node `@vercel/og` file URL bug on some Windows builds. */
export const runtime = "edge";

/**
 * Default Open Graph image (1200×630). Uses system fonts so generation never
 * depends on external font hosts. For a vector fallback see `public/og-default.svg`.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "#A31621",
          fontFamily:
            'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: "#0D1B2A",
            lineHeight: 1.05,
          }}
        >
          VotePulse
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 44,
            fontWeight: 600,
            color: "#F5E8C8",
            maxWidth: 900,
            lineHeight: 1.15,
          }}
        >
          Jersey 2026 Election Intelligence
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 28,
            fontWeight: 500,
            color: "#0D1B2A",
            opacity: 0.95,
          }}
        >
          Non-partisan · Sources cited
        </div>
      </div>
    ),
    { ...size },
  );
}
