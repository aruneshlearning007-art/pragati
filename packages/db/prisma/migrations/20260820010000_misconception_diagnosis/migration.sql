-- Misconception diagnosis: each wrong option on a QuizQuestion is now
-- pre-labeled at generation time with the misconception it represents, so
-- grading a wrong answer can write a MisconceptionTag without a second LLM
-- call. MisconceptionTag gains a count + unique constraint so repeated
-- occurrences of the same misconception upsert into one row instead of
-- growing unbounded.

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN "optionMisconceptions" JSONB;

-- AlterTable
ALTER TABLE "MisconceptionTag" ADD COLUMN "count" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "MisconceptionTag_studentId_subConceptId_type_key" ON "MisconceptionTag"("studentId", "subConceptId", "type");
