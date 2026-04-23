import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { JERSEY_DISTRICT_SET } from "@/lib/jersey-districts";
import { requireAdmin } from "@/lib/admin-guard";
import { slugifyName } from "@/lib/slugify";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      district: candidates.district,
      party: candidates.party,
      bio: candidates.bio,
      manifestoRaw: candidates.manifestoRaw,
      manifestoUrl: candidates.manifestoUrl,
      sourceUrls: candidates.sourceUrls,
    })
    .from(candidates)
    .where(eq(candidates.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    name: row.name,
    district: row.district,
    party: row.party,
    manifesto_raw: row.manifestoRaw,
    bio: row.bio,
    manifesto_url: row.manifestoUrl,
    source_urls: row.sourceUrls,
  });
}

function parseSourceUrls(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const CreateBody = z.object({
  name: z.string().min(1),
  district: z.string().min(1),
  party: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  manifesto_raw: z.string().nullable().optional(),
  manifesto_url: z.string().nullable().optional(),
  source_urls: z.union([z.array(z.string()), z.string()]).optional(),
});

const UpdateBody = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  district: z.string().min(1).optional(),
  party: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  manifesto_raw: z.string().nullable().optional(),
  manifesto_url: z.string().nullable().optional(),
  source_urls: z.union([z.array(z.string()), z.string()]).optional(),
});

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if ("id" in json && json.id) {
    const parsed = UpdateBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    if (d.district && !JERSEY_DISTRICT_SET.has(d.district)) {
      return NextResponse.json({ error: "Invalid district name" }, { status: 400 });
    }

    const updates: Partial<typeof candidates.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (d.name !== undefined) updates.name = d.name;
    if (d.district !== undefined) updates.district = d.district;
    if (d.party !== undefined) updates.party = d.party;
    if (d.bio !== undefined) updates.bio = d.bio;
    if (d.manifesto_raw !== undefined) updates.manifestoRaw = d.manifesto_raw;
    if (d.manifesto_url !== undefined) updates.manifestoUrl = d.manifesto_url;
    if (d.source_urls !== undefined) {
      updates.sourceUrls = parseSourceUrls(d.source_urls);
    }

    const [existing] = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.id, d.id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    await db.update(candidates).set(updates).where(eq(candidates.id, d.id));
    return NextResponse.json({ ok: true, id: d.id });
  }

  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  if (!JERSEY_DISTRICT_SET.has(d.district)) {
    return NextResponse.json({ error: "Invalid district name" }, { status: 400 });
  }

  const baseSlug = slugifyName(d.name);
  let slug = baseSlug;
  let suffix = 2;
  for (let i = 0; i < 50; i++) {
    const [hit] = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.slug, slug))
      .limit(1);
    if (!hit) break;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  const [inserted] = await db
    .insert(candidates)
    .values({
      name: d.name,
      slug,
      district: d.district,
      party: d.party ?? null,
      bio: d.bio ?? null,
      manifestoRaw: d.manifesto_raw ?? null,
      manifestoUrl: d.manifesto_url ?? null,
      sourceUrls: parseSourceUrls(d.source_urls),
    })
    .returning({ id: candidates.id, slug: candidates.slug });

  return NextResponse.json({ ok: true, candidate: inserted }, { status: 201 });
}
