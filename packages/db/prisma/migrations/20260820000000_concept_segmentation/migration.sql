-- Concept-wise generation: a chapter now segments into multiple Topic rows
-- (one per concept) instead of always exactly one, with Notes/Explain/
-- Practice/Video generated per concept — the schema already supported this
-- (everything is topicId-scoped), this just adds the two columns needed to
-- support it end to end: a glossary field on Notes, and topic-attribution
-- on VerifierFlag so the review page can group flags per concept instead of
-- dumping every flag from every concept in one undifferentiated chapter list.

-- AlterTable: Notes gains a per-concept key-terms glossary
ALTER TABLE "Notes" ADD COLUMN "keyTerms" JSONB;

-- AlterTable: VerifierFlag gains topicId (nullable first, backfilled, then required)
ALTER TABLE "VerifierFlag" ADD COLUMN "topicId" TEXT;

-- Backfill existing rows from their chapter's current (sole) topic — every
-- chapter created before this migration has exactly one Topic.
UPDATE "VerifierFlag" AS vf
SET "topicId" = (
  SELECT t."id" FROM "Topic" t WHERE t."chapterId" = vf."chapterId" LIMIT 1
);

ALTER TABLE "VerifierFlag" ALTER COLUMN "topicId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "VerifierFlag_topicId_idx" ON "VerifierFlag"("topicId");

-- AddForeignKey
ALTER TABLE "VerifierFlag" ADD CONSTRAINT "VerifierFlag_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
