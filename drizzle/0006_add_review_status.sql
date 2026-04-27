-- Add Kimi K2.6 supervisor review columns to candidates.
-- review_status stores a ReviewStatus jsonb document
--   { reviewedAt, model, score, passed, flags[], correctedSummary, reasoning }
-- last_reviewed_at lets the daily cron job pick up only summaries enriched
-- since their last review (compared against last_enriched_at).
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS review_status   jsonb,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;
