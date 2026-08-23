-- Self-explain (Feynman technique) feature: a student writes an explanation
-- of a concept in their own words and an AI agent gives qualitative
-- feedback (what's right / what's missing), never a right-or-wrong score.
-- Modeled as a single-row-per-submission event log (like QuizAttempt,
-- DoubtMessage) rather than cached content (like Notes/Explanation).

-- CreateTable
CREATE TABLE "SelfExplanation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "explanationText" TEXT NOT NULL,
    "feedbackText" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelfExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SelfExplanation_studentId_topicId_idx" ON "SelfExplanation"("studentId", "topicId");

-- AddForeignKey
ALTER TABLE "SelfExplanation" ADD CONSTRAINT "SelfExplanation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfExplanation" ADD CONSTRAINT "SelfExplanation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
