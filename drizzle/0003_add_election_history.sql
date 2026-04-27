-- Add election_history JSONB column to candidates table.
-- Stores structured per-election records (results table, turnout, sources)
-- parsed from flow.je profile pages by scripts/import-local-scrapes.ts.
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS election_history jsonb;
