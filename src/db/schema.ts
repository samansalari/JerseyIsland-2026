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
