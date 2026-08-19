-- Adds the 5th Explain mode: a step-by-step worked example, the single
-- most research-validated math teaching technique. In its own migration
-- file/transaction because Postgres won't let a later statement in the
-- SAME transaction reference a just-added enum value.
ALTER TYPE "ExplainMode" ADD VALUE 'worked';
