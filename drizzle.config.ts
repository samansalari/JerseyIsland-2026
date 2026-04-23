import "./load-env";
import { defineConfig } from "drizzle-kit";
import { env } from "./src/lib/env";

/** Host part of a Postgres URI (first @ … / or :port/). */
function pgUriHost(url: string): string | null {
  const m = url.match(/^postgres(ql)?:\/\/[^@]+@([^/?#:]+)/i);
  return m?.[2] ?? null;
}

/** Supabase “direct” DB host is IPv6-first; Node on IPv4-only Windows often throws ENOENT. */
function isSupabaseDirectDbHost(url: string): boolean {
  const h = pgUriHost(url);
  if (!h) return false;
  return h.startsWith("db.") && h.endsWith(".supabase.co");
}

type UrlCandidate = { label: string; url: string | undefined };

/**
 * `drizzle-kit push` URL, first usable candidate in order.
 * Skips `db.<ref>.supabase.co` everywhere (IPv6-first; breaks IPv4 / many Windows setups).
 */
function resolveDrizzleDbUrl(): string {
  // Prefer transaction pooler (6543) first — session (5432) can reject auth depending
  // on pooler settings; both skip db.* direct host.
  const candidates: UrlCandidate[] = [
    { label: "DRIZZLE_DATABASE_URL", url: process.env.DRIZZLE_DATABASE_URL?.trim() },
    { label: "DATABASE_URL", url: env.DATABASE_URL },
    { label: "DIRECT_URL", url: env.DIRECT_URL },
  ];

  for (const { label, url } of candidates) {
    if (!url) continue;
    if (isSupabaseDirectDbHost(url)) {
      // eslint-disable-next-line no-console -- surfaced only when running drizzle-kit
      console.warn(
        `[drizzle-kit] Skipping ${label}: host db.<ref>.supabase.co is IPv6-first and often causes ` +
          `getaddrinfo ENOENT on Windows/IPv4. Use Session pooler (port 5432, user postgres.<ref>) from Dashboard → Connect.`,
      );
      continue;
    }
    return url;
  }

  throw new Error(
    "[drizzle-kit] No usable Postgres URL: every candidate pointed at db.<ref>.supabase.co or was empty.\n" +
      "Set DATABASE_URL or DIRECT_URL to your pooler URI (e.g. aws-1-eu-west-2.pooler.supabase.com:5432 session mode, " +
      "or :6543 transaction mode), or set DRIZZLE_DATABASE_URL to the session pooler string for db:push only.",
  );
}

const drizzleDbUrl = resolveDrizzleDbUrl();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: drizzleDbUrl,
  },
  verbose: true,
  strict: true,
});
