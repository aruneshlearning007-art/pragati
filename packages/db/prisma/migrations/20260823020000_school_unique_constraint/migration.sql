-- Platform-level fix for silent duplicate School rows: two people typing
-- slightly different text for the same real school (e.g. "UP" vs
-- "Uttar Pradesh") used to silently create two separate rows via
-- findFirst-then-create. This constraint lets the "new school" onboarding
-- path use an atomic upsert instead, and is a real DB-level guarantee
-- against future exact-duplicate rows going forward. Existing rows that
-- differ only by text (not caught by this exact-match constraint) are
-- deliberately left untouched - see CLAUDE.md.

-- CreateIndex
CREATE UNIQUE INDEX "School_name_state_city_key" ON "School"("name", "state", "city");
