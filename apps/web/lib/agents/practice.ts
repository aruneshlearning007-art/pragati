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
  const isMath = topic.chapter.subject.nameEn.toLowerCase().includes("math");

  const system = withBaseInstructions(
    "You are the Practice Agent. Write a topic quiz that genuinely diagnoses understanding, not just memorized " +
      "wording — cover every sub-concept listed, with at least 2 questions each. " +
      (options?.sourceText
        ? "The source chapter text provided may cover multiple topics/concepts — base every question strictly " +
          "on the source, but only on material relevant to THIS topic, ignoring parts of the source about " +
          "other concepts in the same chapter. Never invent facts beyond the source. "
        : "") +
      "Mix question types: roughly half plain \"mcq\", and about a quarter \"assertion_reason\" (a two-part " +
      "question — an assertion and a reason, testing WHETHER the reasoning is correct, not just the fact — " +
      "this is the strongest way to tell a real misconception apart from a lucky guess). Vary difficulty too: " +
      "include at least one pure-recall question and at least one application question (\"if X, what would " +
      "happen\") rather than making every question the same style. " +
      "For every question, write realistic wrong options — each one should be what a student with a specific, " +
      "genuine misunderstanding would actually pick, not a random distractor. " +
      "A \"numeric\" question has NO options array (send an empty array) and no correctIndex (send null) — " +
      "instead it has a correctValue (the right number) and a tolerance (acceptable rounding margin either " +
      "side of it, 0 for an exact integer answer). " +
      (isMath
        ? "Since this is a Math topic, include at least 2 numeric free-response questions (kind: \"numeric\") " +
          "per quiz — typed numeric answers reduce guessing far more than multiple choice for calculation-style " +
          "questions. "
        : "") +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"questions":[{"kind":"mcq or ' +
      'assertion_reason or picture or numeric","text":"string","options":["a","b","c","d"],"correctIndex":' +
      "0 or null if kind is numeric,\"correctValue\":number or null unless kind is numeric," +
      '"tolerance":number or null unless kind is numeric,' +
      '"optionMisconceptions":["a short phrase describing the misunderstanding a student who picks this ' +
      'option holds, or null for the correct option — one entry per option, same order as options, empty ' +
      'array if kind is numeric"],' +
      '"subConceptName":"the closest matching sub-concept name from the list given, or null",' +
      '"imageLabel":"a short placeholder caption if kind is picture, else null"}]} with 6-8 items. ' +
      "Use kind \"picture\" for at most one question, and only if it genuinely helps (the imageLabel describes " +
      "what a diagram/photo placeholder would show).",
  );

  const userContent = options?.sourceText
    ? `Topic: ${topic.titleEn}\nSub-concepts (id:name): ${subConceptList || "(none)"}\n\nSource chapter text:\n${options.sourceText.slice(0, 30000)}`
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
      correctIndex: number | null;
      correctValue?: number | null;
      tolerance?: number | null;
      optionMisconceptions?: (string | null)[];
      subConceptName: string | null;
      imageLabel: string | null;
    }[];
  }>(raw);

  const nameToId = new Map(topic.subConcepts.map((s) => [s.name, s.id]));
  const kindMap: Record<string, QuestionKind> = {
    mcq: "mcq",
    assertion_reason: "assertion_reason",
    picture: "picture",
    numeric: "numeric",
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
          options: (q.options ?? []) as unknown as object,
          correctIndex: q.correctIndex ?? null,
          correctValue: q.correctValue ?? null,
          tolerance: q.tolerance ?? 0,
          optionMisconceptions: q.optionMisconceptions ? (q.optionMisconceptions as unknown as object) : undefined,
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
