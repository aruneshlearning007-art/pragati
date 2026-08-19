-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Chapter" ADD COLUMN "teacherId" TEXT;
ALTER TABLE "Chapter" ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'published';

-- AlterTable
ALTER TABLE "Explanation" ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'published';

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'published';

-- CreateIndex
CREATE INDEX "Chapter_teacherId_idx" ON "Chapter"("teacherId");

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
