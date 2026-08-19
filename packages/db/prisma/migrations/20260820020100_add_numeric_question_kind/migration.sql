-- Adds a numeric free-response question kind — typed answers reduce
-- guessing far more than MCQ for calculation-style questions. Own
-- migration file/transaction for the same reason as the ExplainMode
-- addition above.
ALTER TYPE "QuestionKind" ADD VALUE 'numeric';
