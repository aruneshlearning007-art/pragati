-- Supporting columns for worked examples and numeric-answer questions.
-- All additive/nullability-relaxing — safe, no backfill needed.

-- AlterTable: Explanation gains structured worked-example content
ALTER TABLE "Explanation" ADD COLUMN "workedExample" JSONB;

-- AlterTable: QuizQuestion — correctIndex becomes optional (numeric-kind
-- questions have no options array to index into), gains the numeric
-- target value + acceptable rounding margin.
ALTER TABLE "QuizQuestion" ALTER COLUMN "correctIndex" DROP NOT NULL;
ALTER TABLE "QuizQuestion" ADD COLUMN "correctValue" DOUBLE PRECISION;
ALTER TABLE "QuizQuestion" ADD COLUMN "tolerance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: QuizAttempt — selectedIndex becomes optional, gains the
-- typed numeric response for numeric-kind attempts.
ALTER TABLE "QuizAttempt" ALTER COLUMN "selectedIndex" DROP NOT NULL;
ALTER TABLE "QuizAttempt" ADD COLUMN "numericResponse" DOUBLE PRECISION;
