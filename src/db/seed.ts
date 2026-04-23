import { db, sql } from "./index";
import { issues, type NewIssue } from "./schema";
import { sql as sqlTag } from "drizzle-orm";

/**
 * Seed the `issues` table with Jersey-relevant policy areas.
 *
 * Idempotent: uses ON CONFLICT (name) DO UPDATE so re-running picks up
 * display-name / description / icon edits without duplicating rows.
 *
 * Usage:
 *   pnpm db:seed
 *   tsx src/db/seed.ts
 */

const JERSEY_ISSUES: NewIssue[] = [
  {
    name: "housing",
    displayName: "Housing",
    description:
      "Affordability, supply, first-time buyers, rental market and homelessness in Jersey.",
    icon: "🏠",
  },
  {
    name: "healthcare",
    displayName: "Healthcare",
    description:
      "General Hospital, primary care access, mental health services and waiting times.",
    icon: "🏥",
  },
  {
    name: "tax",
    displayName: "Tax",
    description:
      "Income tax, GST, 20-means-20, corporate tax and the Island's fiscal framework.",
    icon: "💷",
  },
  {
    name: "education",
    displayName: "Education",
    description:
      "Schools, higher-education funding, student loans and skills training.",
    icon: "🎓",
  },
  {
    name: "environment",
    displayName: "Environment",
    description:
      "Climate commitments, biodiversity, coastal protection and carbon neutrality.",
    icon: "🌿",
  },
  {
    name: "transport",
    displayName: "Transport",
    description:
      "Road network, buses, cycling infrastructure, harbour and airport links.",
    icon: "🚌",
  },
  {
    name: "cost_of_living",
    displayName: "Cost of living",
    description:
      "Inflation, wages, utility costs and household budget pressures specific to Jersey.",
    icon: "🧾",
  },
  {
    name: "immigration",
    displayName: "Immigration & population",
    description:
      "Population policy, work permits, Control of Housing and Work Law, and demographics.",
    icon: "🛂",
  },
  {
    name: "economy",
    displayName: "Economy",
    description:
      "Finance industry, diversification, small business support and productivity.",
    icon: "📈",
  },
  {
    name: "public_services",
    displayName: "Public services",
    description:
      "States workforce, service delivery, digital government and accountability.",
    icon: "🏛️",
  },
];

async function main() {
  // eslint-disable-next-line no-console
  console.log(`[seed] upserting ${JERSEY_ISSUES.length} issues…`);

  await db
    .insert(issues)
    .values(JERSEY_ISSUES)
    .onConflictDoUpdate({
      target: issues.name,
      set: {
        displayName: sqlTag`excluded.display_name`,
        description: sqlTag`excluded.description`,
        icon: sqlTag`excluded.icon`,
      },
    });

  const count = await db.$count(issues);
  // eslint-disable-next-line no-console
  console.log(`[seed] ✓ issues table now has ${count} rows`);

  await sql.end({ timeout: 5 });
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error("[seed] ✗", err);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
