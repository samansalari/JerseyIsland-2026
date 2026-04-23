import "../../load-env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { db, sql } from "./index";

/**
 * Apply pending migrations.
 *
 * Step 1 runs hand-written `NNNN_*.sql` in `drizzle/` (e.g. pgcrypto, RLS).
 * Step 2 runs drizzle-kit’s journal migrator if `drizzle/meta/_journal.json` exists
 * (omit when you only use `db:push` without `drizzle-kit generate`).
 *
 * Usage:
 *   pnpm db:migrate           # applies everything
 *   tsx src/db/migrate.ts     # same thing, direct
 */
async function runBootstrap() {
  const dir = join(process.cwd(), "drizzle");
  if (!existsSync(dir)) return;
  const bootstrapFiles = readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f) && f.endsWith(".sql"))
    .sort();
  for (const file of bootstrapFiles) {
    const path = join(dir, file);
    const body = readFileSync(path, "utf8");
    // eslint-disable-next-line no-console
    console.log(`[migrate] bootstrap ${file}`);
    await sql.unsafe(body);
  }
}

async function main() {
  await runBootstrap();
  const journal = join(process.cwd(), "drizzle", "meta", "_journal.json");
  if (existsSync(journal)) {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } else {
    // eslint-disable-next-line no-console
    console.log(
      "[migrate] skip drizzle meta/_journal.json (use drizzle-kit generate if you add versioned migrations)",
    );
  }
  // eslint-disable-next-line no-console
  console.log("[migrate] ✓ up to date");
  await sql.end({ timeout: 5 });
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error("[migrate] ✗", err);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
