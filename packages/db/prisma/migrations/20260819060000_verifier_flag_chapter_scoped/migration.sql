-- Redesign VerifierFlag: it was defined (notesId-linked) but never actually
-- written to by any code — no rows exist, safe to drop and recreate rather
-- than migrate data. Chapter-scoped instead of Notes-scoped, since one
-- verification pass now covers Notes + Explain + Practice together and the
-- teacher review page shows them under one chapter.

-- CreateEnum
CREATE TYPE "VerifierSection" AS ENUM ('notes', 'explain', 'practice');

-- DropForeignKey
ALTER TABLE "VerifierFlag" DROP CONSTRAINT "VerifierFlag_notesId_fkey";

-- DropTable
DROP TABLE "VerifierFlag";

-- CreateTable
CREATE TABLE "VerifierFlag" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "section" "VerifierSection" NOT NULL,
    "quote" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifierFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerifierFlag_chapterId_idx" ON "VerifierFlag"("chapterId");

-- AddForeignKey
ALTER TABLE "VerifierFlag" ADD CONSTRAINT "VerifierFlag_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
