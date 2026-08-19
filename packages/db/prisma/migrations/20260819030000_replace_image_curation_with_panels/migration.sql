-- Wikimedia Commons search couldn't reliably return a *relevant* image for
-- an arbitrary generated topic title (its full-text search matches keywords
-- anywhere in a file's prose description, not just the title — one live
-- test returned an Apollo moon-landing photo for "Shadows and Reflections").
-- Replaced with structured panels the LLM writes directly (see
-- packages/shared/src prompts and apps/web/lib/agents/pedagogy.ts), which is
-- always accurate since it's exactly what the model intended to teach.

-- DropForeignKey
ALTER TABLE "TopicImage" DROP CONSTRAINT "TopicImage_topicId_fkey";

-- DropTable
DROP TABLE "TopicImage";

-- AlterTable
ALTER TABLE "Explanation" ADD COLUMN "panels" JSONB;

-- Reset stale cached picture-mode content so it regenerates in the new format
DELETE FROM "Explanation" WHERE "topicId" = 'seed-topic-shadows-reflections' AND "mode" = 'picture';
