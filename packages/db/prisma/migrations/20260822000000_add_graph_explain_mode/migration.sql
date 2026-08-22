-- Postgres requires ALTER TYPE ... ADD VALUE to run in its own transaction,
-- separate from any migration that depends on the new value (see the
-- "worked" ExplainMode / "numeric" QuestionKind additions for precedent).
ALTER TYPE "ExplainMode" ADD VALUE 'graph';
