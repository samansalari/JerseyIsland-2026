import {
  pgTable,
  uuid,
  text,
  jsonb,
  real,
  integer,
  timestamp,
  boolean,
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

// ── AI-extracted issue stances (Grok) ───────────────────────────────────────
// One `IssueStance` per (candidate, policy issue). Lives inside the
// `candidates.ai_issues` jsonb column. The flat `position` / `source_quote` /
// `confidence` fields are kept for backwards compatibility with rows enriched
// before the action-points pipeline; new fields are `stanceType` and
// `actionPoints`. UI code must treat both new fields as optional.

/** A single concrete thing the candidate proposes to do, opposes, or raises. */
export type ActionPoint = {
  /** Specific, concrete proposal (≤ 150 chars enforced server-side). */
  text: string;
  /**
   * - `action`     — generic thing they will do
   * - `commitment` — firm pledge ("I will…")
   * - `opposition` — explicitly opposes ("I oppose…")
   * - `concern`    — raised concern without a specific solution
   */
  type: "action" | "commitment" | "opposition" | "concern";
  /** Verbatim manifesto quote that supports this point. */
  sourceQuote: string;
};

/** A candidate's full position on one of the 10 canonical policy issues. */
export type IssueStance = {
  /** Slug — one of housing|healthcare|tax|education|environment|transport|cost_of_living|immigration|economy|public_services. */
  issue: string;
  /** One-sentence overview of their stance (kept for backwards compat). */
  position: string;
  /** 0.0–1.0 — how clearly the manifesto states this position. */
  confidence: number;
  /** Primary supporting verbatim quote (kept for backwards compat). */
  source_quote: string;
  /**
   * Overall stance on this issue:
   * - `supportive` — actively proposes specific action
   * - `opposing`   — explicitly opposes a current policy or proposal
   * - `concerned`  — raises the issue but offers no specific solution
   * - `neutral`    — mentions the issue without taking a position
   *
   * Optional because rows enriched before the action-points pipeline
   * predate this field.
   */
  stanceType?: "supportive" | "opposing" | "concerned" | "neutral";
  /** Structured list of concrete proposals — empty `[]` when none extracted. */
  actionPoints?: ActionPoint[];
};

// ── Supervisor review (Kimi K2.6 via OpenRouter) ────────────────────────────
// The supervisor reads the candidate's full manifesto + Grok's ai_summary and
// scores accuracy / neutrality / hallucination. Results are written to
// `candidates.reviewStatus` by `scripts/review-summaries.ts`.
export type ReviewFlag = {
  type:
    | "hallucination"
    | "bias"
    | "attribution_error"
    | "incompleteness"
    | "inaccuracy"
    | "neutrality_breach";
  severity: "low" | "medium" | "high";
  description: string;
  quote: string | null;
};

export type ReviewStatus = {
  reviewedAt: string; // ISO timestamp from the supervisor
  model: string; // e.g. "moonshotai/kimi-k2.6"
  score: number; // 1-10
  passed: boolean; // score >= 7
  flags: ReviewFlag[];
  /** Present only when score < 7 and Kimi proposed a rewrite. */
  correctedSummary: string | null;
  reasoning: string;
};

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

    // Office sought in the 2026 election. `null` for legacy/archived rows
    // that pre-date the column. Application code narrows via $type.
    role: text("role").$type<"Senator" | "Deputy" | "Connétable">(),

    // True for candidates standing in the 2026 general election. Historical
    // entries (previous elections) keep `is_2026 = false` and are excluded
    // from public-facing queries while remaining visible in admin views.
    is2026: boolean("is_2026").notNull().default(false),

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
    // The `ai_issues` jsonb column stores `IssueStance[]` — see the type
    // declared above the table. Old records (pre-action-points pipeline)
    // omit `stanceType` / `actionPoints`; the display layer treats both as
    // optional and falls back gracefully.
    aiIssues: jsonb("ai_issues").$type<IssueStance[]>(),

    // Provenance + change detection.
    sourceUrls: text("source_urls")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    dataHash: text("data_hash"),

    lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
    lastEnrichedAt: timestamp("last_enriched_at", { withTimezone: true }),

    // Supervisor (Kimi K2.6) review results — see ReviewStatus type above.
    reviewStatus: jsonb("review_status").$type<ReviewStatus>(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),

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
    is2026Idx: index("candidates_is_2026_idx").on(t.is2026),
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

// ── cron_logs (daily update pipeline — optional; created via migration) ─────
export const cronLogs = pgTable("cron_logs", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  cycleDate: text("cycle_date").notNull().unique(), // 'YYYY-MM-DD'
  changedCount: integer("changed_count").default(0).notNull(),
  allOk: boolean("all_ok").default(true).notNull(),
  durationMs: integer("duration_ms").default(0).notNull(),
  details: jsonb("details"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type CronLog = typeof cronLogs.$inferSelect;
export type NewCronLog = typeof cronLogs.$inferInsert;
