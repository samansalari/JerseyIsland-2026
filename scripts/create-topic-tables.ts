import "./bootstrap-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[create-tables] ✗ DATABASE_URL not set");
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient);

async function createTables() {
  console.log("Creating topic tables...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS topic_summaries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      issue TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      icon TEXT NOT NULL,
      ai_summary TEXT,
      candidate_count INTEGER DEFAULT 0,
      top_parties JSONB,
      sources_cited JSONB,
      generated_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("  ✓ topic_summaries");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS topic_upvotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      issue TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT topic_upvotes_issue_fingerprint_unique UNIQUE (issue, fingerprint)
    )
  `);
  console.log("  ✓ topic_upvotes");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS topic_feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      issue TEXT NOT NULL,
      feedback_type TEXT NOT NULL,
      content TEXT,
      fingerprint TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("  ✓ topic_feedback");

  console.log("\nAll tables created successfully.");
  await pgClient.end({ timeout: 5 });
  process.exit(0);
}

createTables().catch(async (err) => {
  console.error("✗ Failed:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
