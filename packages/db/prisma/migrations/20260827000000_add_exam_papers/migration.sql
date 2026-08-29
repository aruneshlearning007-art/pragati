-- Teacher-defined exam papers: a teacher sets a reusable exam structure
-- (duration + sections, once per subject+class+board+school) and, once
-- published, any chapter in that subject/class can generate 3 difficulty-
-- tiered sets (Beginner/Intermediate/Advance, via the existing Difficulty
-- enum) matching that structure. PDF-only in this pass - no online
-- answer-taking or auto-grading.

-- CreateEnum
CREATE TYPE "ExamQuestionKind" AS ENUM ('fill_blank', 'true_false', 'mcq', 'subjective');

-- CreateTable
CREATE TABLE "ExamTemplate" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "schoolId" TEXT,
    "board" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamPaper" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "language" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examPaperId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "kind" "ExamQuestionKind" NOT NULL,
    "text" TEXT NOT NULL,
    "options" JSONB,
    "correctIndex" INTEGER,
    "correctText" TEXT,
    "modelAnswer" TEXT,
    "marks" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamTemplate_subjectId_class_board_schoolId_key" ON "ExamTemplate"("subjectId", "class", "board", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPaper_chapterId_templateId_difficulty_language_key" ON "ExamPaper"("chapterId", "templateId", "difficulty", "language");

-- CreateIndex
CREATE INDEX "ExamQuestion_examPaperId_idx" ON "ExamQuestion"("examPaperId");

-- AddForeignKey
ALTER TABLE "ExamTemplate" ADD CONSTRAINT "ExamTemplate_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTemplate" ADD CONSTRAINT "ExamTemplate_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTemplate" ADD CONSTRAINT "ExamTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPaper" ADD CONSTRAINT "ExamPaper_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPaper" ADD CONSTRAINT "ExamPaper_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ExamTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examPaperId_fkey" FOREIGN KEY ("examPaperId") REFERENCES "ExamPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
