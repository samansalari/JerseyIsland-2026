-- Add theme_clusters JSONB column to topic_summaries.
-- Stores Grok-grouped thematic clusters of candidate positions per topic,
-- generated alongside ai_summary by scripts/generate-topics.ts. Each row is
-- a ThemeCluster: { theme, candidateCount, isMinority, exampleNames[] }.
ALTER TABLE topic_summaries
  ADD COLUMN IF NOT EXISTS theme_clusters jsonb;
