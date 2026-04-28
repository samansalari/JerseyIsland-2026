CREATE TABLE IF NOT EXISTS cron_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_date text NOT NULL UNIQUE,
  changed_count integer NOT NULL DEFAULT 0,
  all_ok boolean NOT NULL DEFAULT true,
  duration_ms integer NOT NULL DEFAULT 0,
  details jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
