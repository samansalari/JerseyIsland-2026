/**
 * VotePulse — Validate Social Links
 *
 * Reads every candidate with a non-null social_links column and
 * checks that buildSocialLinks() produces at least one valid URL.
 *
 * Usage:
 *   npm run validate:social
 */

import "./bootstrap-env";
import { isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { candidates } from "../src/db/schema";
import { buildSocialLinks } from "../src/lib/social-links";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[validate:social] ✗ DATABASE_URL not set (.env.local)");
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 2,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient, { schema: { candidates } });

async function validateSocialLinks() {
  const all = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      socialLinks: candidates.socialLinks,
    })
    .from(candidates)
    .where(isNotNull(candidates.socialLinks));

  let valid = 0;
  let invalid = 0;
  const broken: string[] = [];
  const platformCounts: Record<string, number> = {};

  for (const c of all) {
    if (!c.socialLinks) continue;
    const built = buildSocialLinks(c.socialLinks as Record<string, string>);

    if (built.length > 0) {
      valid++;
      for (const link of built) {
        platformCounts[link.platform] = (platformCounts[link.platform] ?? 0) + 1;
      }
    } else {
      invalid++;
      broken.push(c.name);
    }
  }

  console.log(`\n=== SOCIAL LINK VALIDATION ===`);
  console.log(`  Candidates with valid links : ${valid}`);
  console.log(`  Candidates with no valid URLs: ${invalid}`);

  if (broken.length > 0) {
    console.log(`\n  Broken (raw links produced no valid URLs):`);
    for (const name of broken.slice(0, 20)) {
      console.log(`    - ${name}`);
    }
    if (broken.length > 20) {
      console.log(`    … and ${broken.length - 20} more`);
    }
  }

  const sorted = Object.entries(platformCounts).sort(([, a], [, b]) => b - a);
  if (sorted.length > 0) {
    console.log(`\n  Platform breakdown:`);
    for (const [platform, count] of sorted) {
      console.log(`    ${platform.padEnd(20)} ${count}`);
    }
  }

  await pgClient.end({ timeout: 5 });
}

validateSocialLinks().catch(async (e) => {
  console.error(e);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
