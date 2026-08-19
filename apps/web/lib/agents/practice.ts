import { prisma, QuestionKind, ContentStatus } from "@pragati/db";
import { generate, extractJson, withBaseInstructions, type ContentScope } from "@pragati/shared";

export interface QuizQuestionView {
  id: string;
  kind: QuestionKind;
  text: string;
  options: string[];
  imageLabel: string | null;
}

/**
 * Practice Agent (topic quiz mode). Generates a small balanced question
 * bank once per scope and caches it — exam-prep mode (Phase 1+ later) reuses
 * this same bank, weighted by MasteryScore, instead of generating separately.
 *
 * `options.sourceText`/`status` support the teacher-upload review workflow —
 * see the matching comment in notes.ts.
 */
export async function getOrGenerateQuiz(
  topicId: string,
  scope: ContentScope,
  options?: { sourceText?: string; status?: ContentStatus },
): Promise<QuizQuestionView[]> {
  const existing = await prisma.quizQuestion.findMany({
    where: { topicId, board: scope.board, class: scope.class, schoolId: scope.schoolId, status: "published" },
  });
  if (existing.length > 0) {
    return existing.map(toView);
  }

  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { subConcepts: true, chapter: { include: { subject: true } } },
  });

  const subConceptList = topic.subConcepts.map((s) => `${s.id}:${s.name}`).join("; ");

  const system = withBaseInstructions(
    "You are the Practice Agent. Write a short topic quiz that checks real understanding, not memorized wording. " +
      (options?.sourceText
        ? "Base every question strictly on the source chapter text provided — never invent facts beyond it. "
        : "") +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"questions":[{"kind":"mcq or ' +
      'assertion_reason or picture","text":"string","options":["a","b","c","d"],"correctIndex":0,' +
      '"subConceptName":"the closest matching sub-concept name from the list given, or null",' +
      '"imageLabel":"a short placeholder caption if kind is picture, else null"}]} with 4-5 items. ' +
      "Use kind \"picture\" for at most one question, and only if it genuinely helps (the imageLabel describes " +
      "what a diagram/photo placeholder would show).",
  );

  const userContent = options?.sourceText
    ? `Topic: ${topic.titleEn}\nSub-concepts (id:name): ${subConceptList || "(none)"}\n\nSource chapter text:\n${options.sourceText.slice(0, 12000)}`
    : `Topic: ${topic.titleEn}\nSub-concepts (id:name): ${subConceptList || "(none)"}`;

  const raw = await generate({
    system,
    messages: [{ role: "user", content: userContent }],
    json: true,
  });

  const parsed = extractJson<{
    questions: {
      kind: string;
      text: string;
      options: string[];
      correctIndex: number;
      subConceptName: string | null;
      imageLabel: string | null;
    }[];
  }>(raw);

  const nameToId = new Map(topic.subConcepts.map((s) => [s.name, s.id]));
  const kindMap: Record<string, QuestionKind> = {
    mcq: "mcq",
    assertion_reason: "assertion_reason",
    picture: "picture",
  };

  const created = await Promise.all(
    parsed.questions.map((q) =>
      prisma.quizQuestion.create({
        data: {
          topicId,
          subConceptId: q.subConceptName ? nameToId.get(q.subConceptName) ?? null : null,
          board: scope.board,
          class: scope.class,
          schoolId: scope.schoolId,
          kind: kindMap[q.kind] ?? "mcq",
          text: q.text,
          options: q.options as unknown as object,
          correctIndex: q.correctIndex,
          imageLabel: q.imageLabel,
          status: options?.status ?? "published",
        },
      }),
    ),
  );

  return created.map(toView);
}

function toView(q: {
  id: string;
  kind: QuestionKind;
  text: string;
  options: unknown;
  imageLabel: string | null;
}): QuizQuestionView {
  return {
    id: q.id,
    kind: q.kind,
    text: q.text,
    options: q.options as string[],
    imageLabel: q.imageLabel,
  };
}
