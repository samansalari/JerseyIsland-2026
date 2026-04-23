-- Row Level Security for PostgREST (anon / authenticated).
-- Server-side Drizzle uses the database user (bypasses RLS); API clients use policies only.
-- Re-runnable: DROP POLICY IF EXISTS then CREATE.

-- ── articles, candidates, issues, candidate_issues: public read ─────────────
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_public" ON public.articles;
CREATE POLICY "select_public" ON public.articles
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "select_public" ON public.candidates;
CREATE POLICY "select_public" ON public.candidates
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "select_public" ON public.issues;
CREATE POLICY "select_public" ON public.issues
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "select_public" ON public.candidate_issues;
CREATE POLICY "select_public" ON public.candidate_issues
  FOR SELECT TO anon, authenticated
  USING (true);

-- snapshots: RLS on, no anon/authenticated policies (read via server / service_role only)
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
