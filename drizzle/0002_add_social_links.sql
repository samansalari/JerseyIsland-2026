-- Add social_links JSONB column to candidates table.
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS social_links jsonb;
