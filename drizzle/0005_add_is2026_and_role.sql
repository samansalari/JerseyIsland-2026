-- Add `is_2026` flag and `role` field to candidates.
--
-- `is_2026` lets us mark which candidates are actually standing in the
-- 2026 election, so historical entries can be archived (kept for data
-- preservation but hidden from public-facing queries) by setting
-- `is_2026 = false`. Public pages filter `WHERE is_2026 = true`; admin
-- pages show everything so old data stays inspectable.
--
-- `role` captures Senator / Deputy / Connétable, which is new to 2026
-- (the schema previously only carried `district`). Unconstrained text
-- so we don't have to recreate enums on every add — the application
-- layer narrows it via Drizzle's `$type<>()` helper.
--
-- Both columns are added idempotently so this migration is safe to
-- re-run via `runBootstrap` in `src/db/migrate.ts`.

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS is_2026 boolean NOT NULL DEFAULT false;

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS role text;

-- Reset the flag for every existing row so the sync script (which sets
-- `is_2026 = true` only for the official 2026 candidates) starts from
-- a known baseline. The DEFAULT above only applies to rows inserted
-- *after* the column is added, hence this explicit UPDATE.
UPDATE candidates SET is_2026 = false WHERE is_2026 IS NOT FALSE;

CREATE INDEX IF NOT EXISTS candidates_is_2026_idx ON candidates (is_2026);
