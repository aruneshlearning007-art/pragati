-- Reworked "picture" mode from a card grid (icon+title+description panels,
-- no spatial relationship between them) into an actual sequence diagram:
-- ordered steps connected by labeled arrows, which looks like a real
-- labeled flow diagram instead of a list of cards.

-- AlterTable
ALTER TABLE "Explanation" RENAME COLUMN "panels" TO "diagram";

-- Reset stale cached picture-mode content so it regenerates in the new format
DELETE FROM "Explanation" WHERE "topicId" = 'seed-topic-shadows-reflections' AND "mode" = 'picture';
