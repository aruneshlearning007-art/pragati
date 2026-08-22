import { prisma } from "@pragati/db";
import type { ContentScope } from "@pragati/shared";

/**
 * Diagnostic Engine — deterministic, no LLM call. Sole writer of
 * MasteryScore and MisconceptionTag. Thresholds mirror the prototype:
 * >=80% correct -> mastered, >=40% -> revision, else revision-low.
 * Misconception classification is a free lookup, not a second LLM call —
 * the Practice Agent (practice.ts) pre-labels each wrong option at
 * generation time with the misconception it represents.
 */
export interface QuizSubmitResult {
  score: number;
  total: number;
  correctByQuestionId: Record<string, boolean>;
  feedbackByQuestionId: Record<string, { correctIndex: number | null; correctValue: number | null; misconception: string | null }>;
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
  const feedbackByQuestionId: QuizSubmitResult["feedbackByQuestionId"] = {};
  let correctCount = 0;

  for (const [questionId, rawValue] of Object.entries(answers)) {
    const question = questionById.get(questionId);
    if (!question) continue;
    const isNumeric = question.kind === "numeric";
    const correct = isNumeric
      ? question.correctValue != null && Math.abs(rawValue - question.correctValue) <= question.tolerance
      : rawValue === question.correctIndex;
    correctByQuestionId[questionId] = correct;
    if (correct) correctCount++;

    // No per-option misconception labels for numeric questions — there's
    // no options array to index into.
    let misconception: string | null = null;
    if (!correct && !isNumeric) {
      const labels = question.optionMisconceptions as unknown as (string | null)[] | null;
      misconception = labels?.[rawValue] ?? null;
      if (misconception && question.subConceptId) {
        await prisma.misconceptionTag.upsert({
          where: { studentId_subConceptId_type: { studentId, subConceptId: question.subConceptId, type: misconception } },
          update: { count: { increment: 1 }, lastSeen: new Date() },
          create: { studentId, subConceptId: question.subConceptId, type: misconception },
        });
      }
    }
    feedbackByQuestionId[questionId] = { correctIndex: question.correctIndex, correctValue: question.correctValue, misconception };

    await prisma.quizAttempt.create({
      data: {
        studentId,
        topicId,
        questionId,
        selectedIndex: isNumeric ? null : rawValue,
        numericResponse: isNumeric ? rawValue : null,
        correct,
      },
    });
  }

  await updateMasteryForTopic(studentId, topicId, questionIds);

  return { score: correctCount, total: questionIds.length, correctByQuestionId, feedbackByQuestionId };
}

/**
 * Sub-concepts this student has repeatedly shown the same misconception on
 * (count >= 2 — a single wrong answer could just be a guess, not a real
 * pattern) within one topic. Used to give Doubt-chat a personalized nudge
 * without touching the scope-cached Explain content (see doubt.ts).
 */
export async function getActiveMisconceptions(studentId: string, topicId: string): Promise<string[]> {
  const subConcepts = await prisma.subConcept.findMany({ where: { topicId } });
  if (subConcepts.length === 0) return [];

  const tags = await prisma.misconceptionTag.findMany({
    where: { studentId, subConceptId: { in: subConcepts.map((s) => s.id) }, count: { gte: 2 } },
  });
  return tags.map((t) => t.type);
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

export function combineTopicStatuses(results: StatusResult[]): StatusResult {
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

export interface SubjectProgress {
  subjectId: string;
  subjectName: string;
  chapters: { id: string; title: string; status: TopicStatus; progress: number }[];
  overallStatus: TopicStatus;
  overallProgress: number;
}

/**
 * Whole-student, cross-subject summary for the Progress dashboard — every
 * published chapter in the student's scope, grouped by subject, each
 * subject rolled up into one overall status the same way a chapter rolls
 * up its topics. Reuses the existing batched getChapterStatusesByIds
 * rather than querying mastery per-subject.
 */
export async function getProgressOverview(studentId: string, scope: ContentScope, language: string): Promise<SubjectProgress[]> {
  const chapters = await prisma.chapter.findMany({
    where: { class: scope.class, board: scope.board, schoolId: scope.schoolId, status: "published" },
    include: { subject: true },
    orderBy: { createdAt: "asc" },
  });
  if (chapters.length === 0) return [];

  const statusByChapter = await getChapterStatusesByIds(
    studentId,
    chapters.map((c) => c.id),
  );

  const bySubject = new Map<string, typeof chapters>();
  for (const chapter of chapters) {
    const list = bySubject.get(chapter.subjectId) ?? [];
    list.push(chapter);
    bySubject.set(chapter.subjectId, list);
  }

  const result: SubjectProgress[] = [];
  for (const [subjectId, subjectChapters] of bySubject) {
    const chapterViews = subjectChapters.map((c) => {
      const { status, progress } = statusByChapter.get(c.id) ?? { status: "not-started" as const, progress: 0 };
      return { id: c.id, title: language === "hi" ? c.titleHi || c.titleEn : c.titleEn, status, progress };
    });
    const { status: overallStatus, progress: overallProgress } = combineTopicStatuses(
      chapterViews.map((c) => ({ status: c.status, progress: c.progress })),
    );
    const subject = subjectChapters[0].subject;
    result.push({
      subjectId,
      subjectName: language === "hi" ? subject.nameHi || subject.nameEn : subject.nameEn,
      chapters: chapterViews,
      overallStatus,
      overallProgress,
    });
  }
  return result;
}

export interface WeakArea {
  type: string;
  count: number;
  subConceptName: string;
  topicId: string;
  topicTitle: string;
  subjectName: string;
}

/**
 * Every recurring misconception (count >= 2, same threshold as
 * getActiveMisconceptions) across this student's whole history, not
 * scoped to one topic — for the Progress dashboard's "areas to focus on"
 * list. getActiveMisconceptions stays topic-scoped for Doubt-chat's nudge;
 * this is the whole-student view.
 */
export async function getWeakAreasForStudent(studentId: string, language: string): Promise<WeakArea[]> {
  const tags = await prisma.misconceptionTag.findMany({
    where: { studentId, count: { gte: 2 } },
    orderBy: { count: "desc" },
    include: { subConcept: { include: { topic: { include: { chapter: { include: { subject: true } } } } } } },
  });

  return tags.map((t) => ({
    type: t.type,
    count: t.count,
    subConceptName: t.subConcept.name,
    topicId: t.subConcept.topic.id,
    topicTitle: language === "hi" ? t.subConcept.topic.titleHi || t.subConcept.topic.titleEn : t.subConcept.topic.titleEn,
    subjectName:
      language === "hi"
        ? t.subConcept.topic.chapter.subject.nameHi || t.subConcept.topic.chapter.subject.nameEn
        : t.subConcept.topic.chapter.subject.nameEn,
  }));
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istDateString(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Current consecutive-day streak of practice, derived from
 * QuizAttempt.timestamp (no dedicated streak column/table exists).
 * Calendar days are computed in IST, not UTC, since the product is
 * India-only — a raw UTC day boundary would make a streak look broken
 * every day at 5:30am IST instead of local midnight. Counts backward from
 * today, or from yesterday if nothing's logged yet today, so an
 * evening-only streak doesn't appear broken every morning before that
 * day's first attempt.
 */
export async function getStudentStreak(studentId: string): Promise<number> {
  const attempts = await prisma.quizAttempt.findMany({ where: { studentId }, select: { timestamp: true } });
  if (attempts.length === 0) return 0;

  const daysWithActivity = new Set(attempts.map((a) => istDateString(a.timestamp)));

  const cursor = new Date();
  if (!daysWithActivity.has(istDateString(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (daysWithActivity.has(istDateString(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
