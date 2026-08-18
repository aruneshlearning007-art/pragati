-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN "subConceptId" TEXT;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_subConceptId_fkey" FOREIGN KEY ("subConceptId") REFERENCES "SubConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;
