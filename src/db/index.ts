import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Drizzle client.
 *
 * Uses `postgres-js` with a small pool suited to serverless / edge-style
 * environments. We cache the underlying client on `globalThis` in dev so
 * Next.js hot reloads don't exhaust connections.
 */

type PgClient = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as {
  __votepulse_pg?: PgClient;
};

function createClient(): PgClient {
  return postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // friendlier with Supabase pooler
  });
}

export const sql: PgClient =
  globalForDb.__votepulse_pg ??
  (globalForDb.__votepulse_pg =
    env.NODE_ENV === "production" ? createClient() : createClient());

export const db = drizzle(sql, { schema });

/**
 * Lightweight probe used by the health-check route. Returns the DB's
 * current time, which proves both the TCP connection AND that auth works
 * — a plain `SELECT 1` doesn't. Also reports which expected tables exist
 * so the health page can surface "migrations pending" explicitly.
 */
export async function pingDatabase(): Promise<{
  ok: true;
  now: Date;
  version: string;
  tables: {
    candidates: boolean;
    articles: boolean;
    issues: boolean;
    candidate_issues: boolean;
    snapshots: boolean;
  };
  issueCount: number | null;
}> {
  const rows = await sql<
    { now: Date; version: string }[]
  >`SELECT NOW() AS now, version() AS version`;
  const row = rows[0];
  if (!row) throw new Error("Empty response from Postgres");

  const expected = [
    "candidates",
    "articles",
    "issues",
    "candidate_issues",
    "snapshots",
  ] as const;

  const present = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${sql.array([
      ...expected,
    ])})
  `;
  const presentSet = new Set(present.map((r) => r.table_name));
  const tables = Object.fromEntries(
    expected.map((t) => [t, presentSet.has(t)]),
  ) as Record<(typeof expected)[number], boolean>;

  let issueCount: number | null = null;
  if (tables.issues) {
    const [c] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM issues`;
    issueCount = c?.n ?? 0;
  }

  return {
    ok: true,
    now: row.now,
    version: row.version,
    tables,
    issueCount,
  };
}
