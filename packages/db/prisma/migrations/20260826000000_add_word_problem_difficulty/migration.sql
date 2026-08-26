-- Word-problem tagging for Math practice questions: isWordProblem marks a
-- question as an application/word problem (vs a plain recall/procedural
-- one), and difficulty tiers it easy/medium/hard so a student can pick a
-- level rather than getting whatever mix the quiz happened to generate.
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

ALTER TABLE "QuizQuestion" ADD COLUMN "isWordProblem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QuizQuestion" ADD COLUMN "difficulty" "Difficulty";
