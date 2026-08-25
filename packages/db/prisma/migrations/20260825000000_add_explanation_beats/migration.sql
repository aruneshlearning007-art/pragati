-- Nullable structured content for the Story/Real-world/Go-further Explain
-- modes: an ordered array of {label, text} beats, same per-mode-only
-- pattern as the existing diagram/workedExample/graph columns. Lets those
-- three modes render as labeled beats like Notes' sections, instead of one
-- flat paragraph. `body` keeps holding a short one-line intro for these
-- modes (same convention picture/worked already use), so old cached rows
-- with no beats still render correctly via their existing body text.
ALTER TABLE "Explanation" ADD COLUMN "beats" JSONB;
