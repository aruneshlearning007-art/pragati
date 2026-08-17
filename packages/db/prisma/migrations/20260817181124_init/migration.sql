-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('student', 'parent', 'teacher');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'awaiting_review', 'published', 'needs_changes');

-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('mcq', 'assertion_reason', 'picture');

-- CreateEnum
CREATE TYPE "ExplainMode" AS ENUM ('story', 'picture', 'realworld', 'gofurther');

-- CreateEnum
CREATE TYPE "DoubtRole" AS ENUM ('user', 'assistant');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "board" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "class" TEXT,
    "board" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "schoolId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentStudentLink" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "ParentStudentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleHi" TEXT,
    "class" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleHi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubConcept" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SubConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedSource" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "schoolId" TEXT,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT,
    "class" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notes" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "sourceId" TEXT,
    "schoolId" TEXT,
    "board" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifierFlag" (
    "id" TEXT NOT NULL,
    "notesId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "VerifierFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Explanation" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "schoolId" TEXT,
    "board" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "mode" "ExplainMode" NOT NULL,
    "body" TEXT NOT NULL,
    "imageLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Explanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "schoolId" TEXT,
    "board" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "kind" "QuestionKind" NOT NULL,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "imageLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedIndex" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasteryScore" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subConceptId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasteryScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MisconceptionTag" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subConceptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MisconceptionTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedagogyPreference" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mode" "ExplainMode" NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PedagogyPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoubtMessage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "role" "DoubtRole" NOT NULL,
    "text" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubtMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedByTeacher" BOOLEAN NOT NULL DEFAULT false,
    "resolvedByParent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "School_state_city_idx" ON "School"("state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudentLink_parentId_studentId_key" ON "ParentStudentLink"("parentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_nameEn_key" ON "Subject"("nameEn");

-- CreateIndex
CREATE INDEX "Chapter_subjectId_class_board_idx" ON "Chapter"("subjectId", "class", "board");

-- CreateIndex
CREATE INDEX "Topic_chapterId_idx" ON "Topic"("chapterId");

-- CreateIndex
CREATE INDEX "SubConcept_topicId_idx" ON "SubConcept"("topicId");

-- CreateIndex
CREATE INDEX "UploadedSource_teacherId_idx" ON "UploadedSource"("teacherId");

-- CreateIndex
CREATE INDEX "UploadedSource_schoolId_idx" ON "UploadedSource"("schoolId");

-- CreateIndex
CREATE INDEX "Notes_topicId_board_class_schoolId_language_idx" ON "Notes"("topicId", "board", "class", "schoolId", "language");

-- CreateIndex
CREATE INDEX "VerifierFlag_notesId_idx" ON "VerifierFlag"("notesId");

-- CreateIndex
CREATE INDEX "Explanation_topicId_board_class_schoolId_language_mode_idx" ON "Explanation"("topicId", "board", "class", "schoolId", "language", "mode");

-- CreateIndex
CREATE INDEX "QuizQuestion_topicId_board_class_schoolId_idx" ON "QuizQuestion"("topicId", "board", "class", "schoolId");

-- CreateIndex
CREATE INDEX "QuizAttempt_studentId_topicId_idx" ON "QuizAttempt"("studentId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "MasteryScore_studentId_subConceptId_key" ON "MasteryScore"("studentId", "subConceptId");

-- CreateIndex
CREATE INDEX "MisconceptionTag_studentId_subConceptId_idx" ON "MisconceptionTag"("studentId", "subConceptId");

-- CreateIndex
CREATE UNIQUE INDEX "PedagogyPreference_studentId_mode_key" ON "PedagogyPreference"("studentId", "mode");

-- CreateIndex
CREATE INDEX "Video_topicId_idx" ON "Video"("topicId");

-- CreateIndex
CREATE INDEX "DoubtMessage_studentId_topicId_idx" ON "DoubtMessage"("studentId", "topicId");

-- CreateIndex
CREATE INDEX "SafetyIncident_studentId_idx" ON "SafetyIncident"("studentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubConcept" ADD CONSTRAINT "SubConcept_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedSource" ADD CONSTRAINT "UploadedSource_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedSource" ADD CONSTRAINT "UploadedSource_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedSource" ADD CONSTRAINT "UploadedSource_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notes" ADD CONSTRAINT "Notes_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notes" ADD CONSTRAINT "Notes_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "UploadedSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notes" ADD CONSTRAINT "Notes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifierFlag" ADD CONSTRAINT "VerifierFlag_notesId_fkey" FOREIGN KEY ("notesId") REFERENCES "Notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryScore" ADD CONSTRAINT "MasteryScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryScore" ADD CONSTRAINT "MasteryScore_subConceptId_fkey" FOREIGN KEY ("subConceptId") REFERENCES "SubConcept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisconceptionTag" ADD CONSTRAINT "MisconceptionTag_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisconceptionTag" ADD CONSTRAINT "MisconceptionTag_subConceptId_fkey" FOREIGN KEY ("subConceptId") REFERENCES "SubConcept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogyPreference" ADD CONSTRAINT "PedagogyPreference_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtMessage" ADD CONSTRAINT "DoubtMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtMessage" ADD CONSTRAINT "DoubtMessage_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

