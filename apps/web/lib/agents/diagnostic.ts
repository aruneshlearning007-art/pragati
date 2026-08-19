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
export interface StatusResult {
  status: TopicStatus;
  progress: number;
}

function computeStatus(subConceptIds: string[], scoreBySubConcept: Map<string, number>): StatusResult {
  if (subConceptIds.length === 0) return { status: "not-started", progress: 0 };
  const scores = subConceptIds.map((id) => scoreBySubConcept.get(id)).filter((s): s is number => s !== undefined);
  if (scores.length === 0) return { status: "not-started", progress: 0 };
  const avg = scores.reduce((sum, s) => sum + s, 0) / subConceptIds.length;
  const status: TopicStatus = avg >= 80 ? "mastered" : avg > 0 ? "revision" : "not-started";
  return { status, progress: Math.round(avg) };
}

function combineTopicStatuses(results: StatusResult[]): StatusResult {
  if (results.length === 0) return { status: "not-started", progress: 0 };
  const progress = Math.round(results.reduce((sum, r) => sum + r.progress, 0) / results.length);
  let status: TopicStatus;
  if (results.every((r) => r.status === "mastered")) status = "mastered";
  else if (results.some((r) => r.status !== "not-started")) status = "revision";
  else status = "not-started";
  return { status, progress };
}

export async function getTopicStatus(studentId: string, topicId: string): Promise<StatusResult> {
  const subConcepts = await prisma.subConcept.findMany({ where: { topicId } });
  const scores = await prisma.masteryScore.findMany({
    where: { studentId, subConceptId: { in: subConcepts.map((s) => s.id) } },
  });
  const scoreMap = new Map(scores.map((s) => [s.subConceptId, s.score]));
  return computeStatus(
    subConcepts.map((s) => s.id),
    scoreMap,
  );
}

/**
 * Per-topic statuses for every topic in one chapter, batched into a fixed
 * 3 queries regardless of how many topics/concepts the chapter has —
 * avoids the N+1 pattern of calling getTopicStatus once per topic, which
 * got a lot more expensive once chapters routinely have several concepts
 * (each its own Topic) instead of just one.
 */
export async function getTopicStatusesByChapter(studentId: string, chapterId: string): Promise<Map<string, StatusResult>> {
  const topics = await prisma.topic.findMany({ where: { chapterId } });
  if (topics.length === 0) return new Map();

  const topicIds = topics.map((t) => t.id);
  const subConcepts = await prisma.subConcept.findMany({ where: { topicId: { in: topicIds } } });
  const scores = await prisma.masteryScore.findMany({
    where: { studentId, subConceptId: { in: subConcepts.map((s) => s.id) } },
  });
  const scoreMap = new Map(scores.map((s) => [s.subConceptId, s.score]));

  const subConceptIdsByTopic = new Map<string, string[]>();
  for (const sc of subConcepts) {
    const list = subConceptIdsByTopic.get(sc.topicId) ?? [];
    list.push(sc.id);
    subConceptIdsByTopic.set(sc.topicId, list);
  }

  const result = new Map<string, StatusResult>();
  for (const topic of topics) {
    result.set(topic.id, computeStatus(subConceptIdsByTopic.get(topic.id) ?? [], scoreMap));
  }
  return result;
}

export async function getChapterStatus(studentId: string, chapterId: string): Promise<StatusResult> {
  const perTopic = await getTopicStatusesByChapter(studentId, chapterId);
  return combineTopicStatuses([...perTopic.values()]);
}

/**
 * Chapter statuses for a whole list of chapters, batched into a fixed 3
 * queries total (not 3-per-chapter) — used by the student subject page,
 * which previously called getChapterStatus once per chapter and, inside
 * that, getTopicStatus once per topic: for N chapters averaging M
 * concepts each, that was 1 + N*(1 + M*2) queries. This is 3 total.
 */
export async function getChapterStatusesByIds(studentId: string, chapterIds: string[]): Promise<Map<string, StatusResult>> {
  if (chapterIds.length === 0) return new Map();

  const topics = await prisma.topic.findMany({ where: { chapterId: { in: chapterIds } } });
  const topicIds = topics.map((t) => t.id);
  const subConcepts = topicIds.length > 0 ? await prisma.subConcept.findMany({ where: { topicId: { in: topicIds } } }) : [];
  const scores =
    subConcepts.length > 0
      ? await prisma.masteryScore.findMany({ where: { studentId, subConceptId: { in: subConcepts.map((s) => s.id) } } })
      : [];
  const scoreMap = new Map(scores.map((s) => [s.subConceptId, s.score]));

  const subConceptIdsByTopic = new Map<string, string[]>();
  for (const sc of subConcepts) {
    const list = subConceptIdsByTopic.get(sc.topicId) ?? [];
    list.push(sc.id);
    subConceptIdsByTopic.set(sc.topicId, list);
  }

  const topicsByChapter = new Map<string, string[]>();
  for (const topic of topics) {
    const list = topicsByChapter.get(topic.chapterId) ?? [];
    list.push(topic.id);
    topicsByChapter.set(topic.chapterId, list);
  }

  const result = new Map<string, StatusResult>();
  for (const chapterId of chapterIds) {
    const chapterTopicIds = topicsByChapter.get(chapterId) ?? [];
    const perTopic = chapterTopicIds.map((topicId) => computeStatus(subConceptIdsByTopic.get(topicId) ?? [], scoreMap));
    result.set(chapterId, combineTopicStatuses(perTopic));
  }
  return result;
}
