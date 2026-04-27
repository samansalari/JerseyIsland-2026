import "./bootstrap-env";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

async function main() {
  const [counts] = await sql<
    {
      total_with_summary: number;
      reviewed: number;
      passed: number;
      failed: number;
      avg_score: string | null;
    }[]
  >`
    SELECT
      count(*) FILTER (WHERE ai_summary IS NOT NULL)::int          AS total_with_summary,
      count(*) FILTER (WHERE last_reviewed_at IS NOT NULL)::int    AS reviewed,
      count(*) FILTER (WHERE (review_status->>'passed')::boolean = true)::int  AS passed,
      count(*) FILTER (WHERE (review_status->>'passed')::boolean = false)::int AS failed,
      ROUND(AVG((review_status->>'score')::numeric), 2)::text      AS avg_score
    FROM candidates;
  `;
  console.log(
    `reviewed: ${counts.reviewed}/${counts.total_with_summary}  passed: ${counts.passed}  failed: ${counts.failed}  avg: ${counts.avg_score ?? "—"}`,
  );

  const recent = await sql<
    { name: string; score: number; passed: boolean; reviewed_at: string }[]
  >`
    SELECT name,
           (review_status->>'score')::int       AS score,
           (review_status->>'passed')::boolean  AS passed,
           to_char(last_reviewed_at, 'HH24:MI:SS') AS reviewed_at
    FROM candidates
    WHERE last_reviewed_at IS NOT NULL
    ORDER BY last_reviewed_at DESC
    LIMIT 5;
  `;
  for (const r of recent) {
    console.log(
      `  ${r.reviewed_at}  ${(r.passed ? "✓" : "✗")} ${r.score}/10  ${r.name}`,
    );
  }
  await sql.end({ timeout: 5 });
}
main().catch(async (e) => {
  console.error(e);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
