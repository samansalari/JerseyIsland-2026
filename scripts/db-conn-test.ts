/**
 * Test which Postgres URL in env actually authenticates (no secrets printed).
 * Usage: npx tsx scripts/db-conn-test.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import postgres from "postgres";

config({ path: resolve(process.cwd(), ".env.local") });
config();

function logPgEnvOverrides(): void {
  const keys = [
    "PGUSER",
    "PGPASSWORD",
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
  ] as const;
  // eslint-disable-next-line no-console
  console.log("— PG* env in this shell (if set, `postgres` package may use them when URI fields are empty):");
  for (const k of keys) {
    if (process.env[k]) {
      // eslint-disable-next-line no-console
      console.log(`  ${k}=<set, length ${(process.env[k] ?? "").length}>`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`  ${k}=(unset)`);
    }
  }
}

/** Safe: host, port, user from URI (not password). */
function describeUriNoSecrets(url: string): string {
  try {
    // WHATWG URL requires a supported scheme; re-use https for display-only parsing.
    const u = new URL(
      url.replace(/^postgres(ql)?:/i, "https:"),
    );
    return `${decodeURIComponent(u.username)} @ ${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(could not parse URL)";
  }
}

const labels: { name: string; url: string | undefined }[] = [
  { name: "DRIZZLE_DATABASE_URL", url: process.env.DRIZZLE_DATABASE_URL?.trim() },
  { name: "DATABASE_URL", url: process.env.DATABASE_URL?.trim() },
  { name: "DIRECT_URL", url: process.env.DIRECT_URL?.trim() },
];

async function tryUrl(name: string, url: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\n[${name}] ${describeUriNoSecrets(url)}`);
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 12 });
  try {
    await sql`select 1 as ok`;
    // eslint-disable-next-line no-console
    console.log(`OK  ${name}`);
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    // eslint-disable-next-line no-console
    console.log(`FAIL ${name}: ${err.code ?? ""} ${err.message ?? e}`);
    if (err.code === "28P01" || /password authentication failed/i.test(String(err.message))) {
      // eslint-disable-next-line no-console
      console.log(
        "  → The database password in the URI is wrong, or the URI was hand-edited. " +
          "In Supabase: Project settings → Database → reset password, " +
          "then Connect and copy the Transaction / Session pooler strings in full (do not use the old password).",
      );
    }
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

async function main() {
  logPgEnvOverrides();
  for (const { name, url } of labels) {
    if (!url) {
      // eslint-disable-next-line no-console
      console.log(`SKIP ${name} (empty)`);
      continue;
    }
    await tryUrl(name, url);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
