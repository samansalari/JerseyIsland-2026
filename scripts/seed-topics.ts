import "./bootstrap-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { topicSummaries } from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[seed-topics] ✗ DATABASE_URL not set");
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  prepare: false,
});
const db = drizzle(pgClient);

const TOPICS = [
  { issue: "housing",         displayName: "Housing",         icon: "🏠" },
  { issue: "healthcare",      displayName: "Healthcare",      icon: "🏥" },
  { issue: "tax",             displayName: "Tax",             icon: "💰" },
  { issue: "education",       displayName: "Education",       icon: "📚" },
  { issue: "environment",     displayName: "Environment",     icon: "🌿" },
  { issue: "transport",       displayName: "Transport",       icon: "🚌" },
  { issue: "cost_of_living",  displayName: "Cost of Living",  icon: "🛒" },
  { issue: "immigration",     displayName: "Immigration",     icon: "🌍" },
  { issue: "economy",         displayName: "Economy",         icon: "📈" },
  { issue: "public_services", displayName: "Public Services", icon: "🏛️" },
] as const;

async function seedTopics() {
  console.log("Seeding topic_summaries...");
  for (const topic of TOPICS) {
    await db
      .insert(topicSummaries)
      .values({
        ...topic,
        aiSummary: null,
        candidateCount: 0,
        sourcesCited: [],
        topParties: [],
      })
      .onConflictDoUpdate({
        target: topicSummaries.issue,
        set: { displayName: topic.displayName, icon: topic.icon },
      });
    console.log(`  ✓ ${topic.displayName}`);
  }
  console.log(`\nDone — ${TOPICS.length} topics seeded.`);
  await pgClient.end({ timeout: 5 });
  process.exit(0);
}

seedTopics().catch(async (err) => {
  console.error("[seed-topics] ✗ Fatal:", err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
