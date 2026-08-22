-- Nullable structured content for the new "graph" Explain mode, same
-- per-mode-only pattern as the existing diagram/workedExample columns.
ALTER TABLE "Explanation" ADD COLUMN "graph" JSONB;
