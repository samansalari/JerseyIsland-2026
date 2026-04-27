import {
  pgTable,
  uuid,
  text,
  jsonb,
  real,
  integer,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * VotePulse schema — v1.
 *
 * Design principles:
 * - **Raw data is sacred.** `manifesto_raw`, `content_raw`, and `source_urls`
 *   are never overwritten by AI enrichment. Enrichment writes to the
 *   `ai_*` columns and the junction table; change detection uses the
 *   `*_hash` columns so we can diff without re-reading.
 * - **UUIDs everywhere** via `gen_random_uuid()` (pgcrypto) so inserts
 *   don't need a round-trip for ID assignment.
 * - **Auditable history** via `snapshots`: any time we mutate a row, we
 *   write the previous JSON into `snapshots` so editorial changes and
 *   scraper drift are inspectable after the fact.
 *
 * NOTE: `pgcrypto` must be enabled for `gen_random_uuid()`:
 *   CREATE EXTENSION IF NOT EXISTS pgcrypto;
 * The `0000_enable_pgcrypto.sql` migration handles this.
 */

// ── Election history (structured, parsed from flow.je) ──────────────────────
/** A single row in an election results table. */
export type ElectionResult = {
  rank: number;
  name: string;
  party: string | null;
  votes: number | null;
  percentage: string | null;
  /** True if this row is the candidate whose page contains this record. */
  isCandidate: boolean;
};

/** A single election a candidate participated in. */
export type ElectionRecord = {
  year: number;
  /** e.g. "2008 Deputies Election" */
  electionName: string;
  /** e.g. "Deputy of St Brelade No 1" */
  role: string;
  /** e.g. "26th November 2008" */
  date: string | null;
  /** Number of seats available in this election. */
  seats: number | null;
  result: "elected" | "not_elected" | "withdrew" | "unknown";
  candidateVotes: number | null;
  candidatePercentage: string | null;
  candidateRank: number | null;
  totalVotes: number | null;
  registeredVoters: number | null;
  /** e.g. "27.5%" */
  turnout: string | null;
  allResults: ElectionResult[];
  /** URLs from the Sources section of this election block. */
  sources: string[];
  /** Party they ran under in THIS election (may differ from current). */
  party: string | null;
};

export type ElectionHistory = ElectionRecord[];

// ── Candidates ──────────────────────────────────────────────────────────────
export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    district: text("district").notNull(),
    party: text("party"),
    photoUrl: text("photo_url"),
    bio: text("bio"),

    // Sacred raw data — never overwritten by AI.
    manifestoRaw: text("manifesto_raw"),
    manifestoUrl: text("manifesto_url"),

    // Structured election history parsed from flow.je profile pages.
    // Preserved verbatim so the page can render results tables, turnout, and
    // sources without round-tripping through AI.
    electionHistory: jsonb("election_history").$type<ElectionHistory>(),

    // Social links extracted from scraped markdown.
    socialLinks: jsonb("social_links").$type<Record<string, string>>(),

    // AI enrichment (nullable until the pipeline fills them).
    aiSummary: text("ai_summary"),
    aiIssues: jsonb("ai_issues").$type<
      Array<{
        issue: string;
        position: string;
        confidence: number;
        source_quote: string;
      }>
    >(),

    // Provenance + change detection.
    sourceUrls: text("source_urls")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    dataHash: text("data_hash"),

    lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
    lastEnrichedAt: timestamp("last_enriched_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    slugUq: uniqueIndex("candidates_slug_uq").on(t.slug),
    districtIdx: index("candidates_district_idx").on(t.district),
  }),
);

// ── Articles ────────────────────────────────────────────────────────────────
export const articles = pgTable(
  "articles",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    source: text("source").notNull(),
    url: text("url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    contentRaw: text("content_raw"),
    contentHash: text("content_hash"),

    // Denormalised candidate refs so feed queries don't need a join.
    // We don't FK this (arrays can't) — integrity is enforced at write time
    // by the ingest layer. `candidate_issues` carries the strict graph.
    candidateMentions: uuid("candidate_mentions")
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),

    aiSentiment: text("ai_sentiment"), // "positive" | "negative" | "neutral"
    aiSummary: text("ai_summary"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    urlUq: uniqueIndex("articles_url_uq").on(t.url),
    publishedIdx: index("articles_published_at_idx").on(t.publishedAt),
  }),
);

// ── Issues (canonical taxonomy) ─────────────────────────────────────────────
export const issues = pgTable(
  "issues",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(), // machine key: "housing"
    displayName: text("display_name").notNull(), // "Housing"
    description: text("description"),
    icon: text("icon"), // emoji or lucide icon name
  },
  (t) => ({
    nameUq: uniqueIndex("issues_name_uq").on(t.name),
  }),
);

// ── Candidate ⇄ Issue (junction, one row per stance) ────────────────────────
export const candidateIssues = pgTable(
  "candidate_issues",
  {
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "restrict" }),
    position: text("position").notNull(),
    sourceQuote: text("source_quote").notNull(),
    confidence: real("confidence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.candidateId, t.issueId] }),
    issueIdx: index("candidate_issues_issue_idx").on(t.issueId),
  }),
);

// ── Snapshots (append-only change history) ──────────────────────────────────
export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entityType: text("entity_type").notNull(), // "candidate" | "article"
    entityId: uuid("entity_id").notNull(),
    data: jsonb("data").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    entityIdx: index("snapshots_entity_idx").on(t.entityType, t.entityId),
    capturedIdx: index("snapshots_captured_at_idx").on(t.capturedAt),
  }),
);

// ── Issue poll votes ────────────────────────────────────────────────────────
export const issueVotes = pgTable(
  "issue_votes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    issue: text("issue").notNull(),
    voterFingerprint: text("voter_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    issueIdx: index("issue_votes_issue_idx").on(t.issue),
    fingerprintIdx: index("issue_votes_fingerprint_idx").on(t.voterFingerprint),
  }),
);

// ── Candidate community ratings ──────────────────────────────────────────────
export const candidateRatings = pgTable(
  "candidate_ratings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1–5
    voterFingerprint: text("voter_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    candidateIdx: index("candidate_ratings_candidate_idx").on(t.candidateId),
    fingerprintIdx: index("candidate_ratings_fingerprint_idx").on(
      t.voterFingerprint,
    ),
  }),
);

// ── Grok insight cache ───────────────────────────────────────────────────────
export const pulseInsights = pgTable(
  "pulse_insights",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    insightType: text("insight_type").notNull(), // 'issue_analysis' | 'candidate_alignment'
    content: text("content").notNull(),
    sources: jsonb("sources").$type<
      Array<{ headline: string; url: string; source: string }>
    >(),
    generatedAt: timestamp("generated_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (t) => ({
    typeIdx: index("pulse_insights_type_idx").on(t.insightType),
    generatedIdx: index("pulse_insights_generated_idx").on(t.generatedAt),
  }),
);

// ── topic_summaries ───────────────────────────────────────────────────────────
// Grok-generated summary for each issue topic, refreshed by cron

// Grok groups individual candidate positions into 4-8 thematic clusters
// per topic so voters can see the shape of the debate at a glance before
// reading every candidate's wording. Generated by scripts/generate-topics.ts.
export type ThemeCluster = {
  theme: string; // short label e.g. "Affordable GP access" (≤ 60 chars)
  candidateCount: number; // how many candidates align with this theme
  isMinority: boolean; // true if < 10% of total positions on this topic
  exampleNames: string[]; // first 2-3 candidate names as receipts
};

export const topicSummaries = pgTable("topic_summaries", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  issue: text("issue").notNull().unique(), // e.g. "housing"
  displayName: text("display_name").notNull(), // e.g. "Housing"
  icon: text("icon").notNull(), // emoji e.g. "🏠"

  // AI-generated content (Grok output, verified against manifestos)
  aiSummary: text("ai_summary"),
  candidateCount: integer("candidate_count").default(0),
  topParties: jsonb("top_parties"), // {party: string, count: number}[]
  themeClusters: jsonb("theme_clusters").$type<ThemeCluster[]>(),

  // Source traceability
  sourcesCited: jsonb("sources_cited"), // [{candidateName, slug, sourceQuote, manifestoUrl}]

  generatedAt: timestamp("generated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── topic_upvotes ─────────────────────────────────────────────────────────────
// Anonymous upvotes — one per fingerprint per issue
export const topicUpvotes = pgTable(
  "topic_upvotes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    issue: text("issue").notNull(),
    fingerprint: text("fingerprint").notNull(), // SHA256(IP + UA + date) — no PII
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqueVote: unique().on(t.issue, t.fingerprint),
  }),
);

// ── topic_feedback ────────────────────────────────────────────────────────────
// Anonymous text feedback on a topic — stored for admin analysis
export const topicFeedback = pgTable("topic_feedback", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  issue: text("issue").notNull(),
  feedbackType: text("feedback_type").notNull(), // "agree" | "disagree" | "missing" | "wrong"
  content: text("content"), // optional text (max 500 chars, validated server-side)
  fingerprint: text("fingerprint").notNull(), // same as upvotes — no PII
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Typed row helpers ───────────────────────────────────────────────────────
export type Candidate = typeof candidates.$inferSelect;
export type NewCandidate = typeof candidates.$inferInsert;

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;

export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;

export type CandidateIssue = typeof candidateIssues.$inferSelect;
export type NewCandidateIssue = typeof candidateIssues.$inferInsert;

export type Snapshot = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;

/** Shape of the `ai_issues` jsonb column, exported for AI pipeline consumers. */
export type AiIssueFinding = NonNullable<Candidate["aiIssues"]>[number];

/** Allowed values for `articles.ai_sentiment`. */
export type ArticleSentiment = "positive" | "negative" | "neutral";

/** Allowed values for `snapshots.entity_type`. */
export type SnapshotEntityType = "candidate" | "article";

export type IssueVote = typeof issueVotes.$inferSelect;
export type NewIssueVote = typeof issueVotes.$inferInsert;

export type CandidateRating = typeof candidateRatings.$inferSelect;
export type NewCandidateRating = typeof candidateRatings.$inferInsert;

export type PulseInsight = typeof pulseInsights.$inferSelect;
export type NewPulseInsight = typeof pulseInsights.$inferInsert;

export type TopicSummary = typeof topicSummaries.$inferSelect;
export type NewTopicSummary = typeof topicSummaries.$inferInsert;

export type TopicUpvote = typeof topicUpvotes.$inferSelect;
export type NewTopicUpvote = typeof topicUpvotes.$inferInsert;

export type TopicFeedback = typeof topicFeedback.$inferSelect;
export type NewTopicFeedback = typeof topicFeedback.$inferInsert;
