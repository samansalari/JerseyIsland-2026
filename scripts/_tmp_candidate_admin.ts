import "./bootstrap-env";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false });

async function main() {
  const command = process.argv[2];

  if (command === "count-districts") {
    const [row] = await sql<
      { total: number; known: number }[]
    >`select count(*)::int as total, count(*) filter (where district <> 'Unknown')::int as known from candidates`;
    console.log(JSON.stringify(row ?? null, null, 2));
    return;
  }

  if (command === "clear-ai") {
    await sql`update candidates set ai_summary = null, ai_issues = null, last_enriched_at = null`;
    console.log("cleared");
    return;
  }

  if (command === "show-summaries") {
    const slugs = process.argv.slice(3);
    if (slugs.length === 0) {
      console.error("Provide at least one slug");
      process.exit(1);
    }
    const rows: Array<{
      slug: string;
      name: string;
      district: string;
      ai_summary: string | null;
      last_enriched_at: string | null;
    }> = [];

    for (const slug of slugs) {
      const result = await sql<
        {
          slug: string;
          name: string;
          district: string;
          ai_summary: string | null;
          last_enriched_at: string | null;
        }[]
      >`select slug, name, district, ai_summary, last_enriched_at::text from candidates where slug = ${slug} limit 1`;
      if (result[0]) rows.push(result[0]);
    }

    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
