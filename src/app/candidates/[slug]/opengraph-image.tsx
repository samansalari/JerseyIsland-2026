import { ImageResponse } from "next/og";
import { db } from "@/db";

export const runtime = "nodejs";
import { candidates } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const alt = "VotePulse candidate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ slug: string }> };

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const [row] = await db
    .select({ name: candidates.name, district: candidates.district })
    .from(candidates)
    .where(and(eq(candidates.slug, slug), eq(candidates.is2026, true)))
    .limit(1);

  const name = row?.name ?? "Candidate";
  const district = row?.district ?? "Jersey 2026";

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
            fontSize: 72,
            fontWeight: 700,
            color: "#0D1B2A",
            lineHeight: 1.1,
          }}
        >
          {name}
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 36,
            fontWeight: 600,
            color: "#F5E8C8",
          }}
        >
          {district}
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 28,
            fontWeight: 600,
            color: "#0D1B2A",
          }}
        >
          VotePulse · Jersey 2026
        </div>
      </div>
    ),
    { ...size },
  );
}
