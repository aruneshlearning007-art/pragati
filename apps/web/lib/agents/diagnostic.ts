import { prisma } from "@pragati/db";

/**
 * Diagnostic Engine — deterministic, no LLM call. Sole writer of
 * MasteryScore. Thresholds mirror the prototype: >=80% correct -> mastered,
 * >=40% -> revision, else revision-low. Misconception classification
 * (Phase 4) will read the same QuizAttempt rows this writes.
 */
export interface QuizSubmitResult {
  score: number;
  total: number;
  correctByQuestionId: Record<string, boolean>;
}

export async function submitQuizAnswers(
  studentId: string,
  topicId: string,
  answers: Record<string, number>,
): Promise<QuizSubmitResult> {
  const questionIds = Object.keys(answers);
  const questions = await prisma.quizQuestion.findMany({ where: { id: { in: questionIds } } });
  const questionById = new Map(questions.map((q) => [q.id, q]));

  const correctByQuestionId: Record<string, boolean> = {};
  let correctCount = 0;

  for (const [questionId, selectedIndex] of Object.entries(answers)) {
    const question = questionById.get(questionId);
    if (!question) continue;
    const correct = selectedIndex === question.correctIndex;
    correctByQuestionId[questionId] = correct;
    if (correct) correctCount++;

    await prisma.quizAttempt.create({
      data: { studentId, topicId, questionId, selectedIndex, correct },
    });
  }

  await updateMasteryForTopic(studentId, topicId, questionIds);

  return { score: correctCount, total: questionIds.length, correctByQuestionId };
}

async function updateMasteryForTopic(studentId: string, topicId: string, questionIds: string[]): Promise<void> {
  const questions = await prisma.quizQuestion.findMany({ where: { id: { in: questionIds } } });
  const subConceptIds = [...new Set(questions.map((q) => q.subConceptId).filter((id): id is string => !!id))];

  for (const subConceptId of subConceptIds) {
    const subConceptQuestionIds = questions.filter((q) => q.subConceptId === subConceptId).map((q) => q.id);
    const attempts = await prisma.quizAttempt.findMany({
      where: { studentId, questionId: { in: subConceptQuestionIds } },
      orderBy: { timestamp: "desc" },
    });
    // Latest attempt per question only.
    const latestByQuestion = new Map<string, boolean>();
    for (const a of attempts) {
      if (!latestByQuestion.has(a.questionId)) latestByQuestion.set(a.questionId, a.correct);
    }
    const total = latestByQuestion.size;
    const correct = [...latestByQuestion.values()].filter(Boolean).length;
    const pct = total ? correct / total : 0;

    const score = pct >= 0.8 ? 100 : pct >= 0.4 ? 60 : 30;

    await prisma.masteryScore.upsert({
      where: { studentId_subConceptId: { studentId, subConceptId } },
      update: { score },
      create: { studentId, subConceptId, score },
    });
  }
}

export type TopicStatus = "mastered" | "revision" | "not-started";

export async function getTopicStatus(studentId: string, topicId: string): Promise<{ status: TopicStatus; progress: number }> {
  const subConcepts = await prisma.subConcept.findMany({ where: { topicId } });
  if (subConcepts.length === 0) return { status: "not-started", progress: 0 };

  const scores = await prisma.masteryScore.findMany({
    where: { studentId, subConceptId: { in: subConcepts.map((s) => s.id) } },
  });

  if (scores.length === 0) return { status: "not-started", progress: 0 };

  const avg = scores.reduce((sum, s) => sum + s.score, 0) / subConcepts.length;
  const status: TopicStatus = avg >= 80 ? "mastered" : avg > 0 ? "revision" : "not-started";
  return { status, progress: Math.round(avg) };
}

export async function getChapterStatus(
  studentId: string,
  chapterId: string,
): Promise<{ status: TopicStatus; progress: number }> {
  const topics = await prisma.topic.findMany({ where: { chapterId } });
  if (topics.length === 0) return { status: "not-started", progress: 0 };

  const results = await Promise.all(topics.map((t) => getTopicStatus(studentId, t.id)));
  const progress = Math.round(results.reduce((sum, r) => sum + r.progress, 0) / results.length);
  let status: TopicStatus;
  if (results.every((r) => r.status === "mastered")) status = "mastered";
  else if (results.some((r) => r.status !== "not-started")) status = "revision";
  else status = "not-started";
  return { status, progress };
}
