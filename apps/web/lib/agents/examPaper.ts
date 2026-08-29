import { prisma, Difficulty, ExamQuestionKind } from "@pragati/db";
import { generate, extractJson, withBaseInstructions } from "@pragati/shared";
import type { NotesSection, KeyTerm } from "./notes";

export interface ExamTemplateSection {
  label: string;
  kind: ExamQuestionKind;
  count: number;
  marksEach: number;
}

export interface ExamQuestionView {
  id: string;
  section: string;
  kind: ExamQuestionKind;
  text: string;
  options: string[] | null;
  correctIndex: number | null;
  correctText: string | null;
  modelAnswer: string | null;
  marks: number;
  order: number;
}

export interface ExamPaperView {
  difficulty: Difficulty;
  durationMinutes: number;
  totalMarks: number;
  templateSections: ExamTemplateSection[];
  questions: ExamQuestionView[];
}

const DIFFICULTY_GUIDANCE: Record<Difficulty, string> = {
  easy:
    "Beginner level: foundational, direct recall straight from the material - the most basic facts and " +
    "definitions, phrased plainly.",
  medium:
    "Intermediate level: one-step application - combining two related facts, or applying a concept to a " +
    "simple new situation not stated verbatim in the material.",
  hard:
    "Advance level: multi-step reasoning or synthesis - requires connecting more than one sub-concept/topic " +
    "from this chapter, or applying the concept to a less obvious scenario.",
};

const SECTION_LETTERS = "ABCDEFGHIJ";

/**
 * Exam Paper Agent. Generates one difficulty-tiered mock exam (PDF-only,
 * no online answer-taking/auto-grading) for a chapter, following a
 * teacher-defined ExamTemplate's exact section structure. Grounded in the
 * chapter's already-generated, already-verified Notes content (not the raw
 * UploadedSource text, which is only reachable indirectly via Notes.sourceId
 * and doesn't exist at all for system-seeded chapters) - Notes are a more
 * reliable, universally-available source for a chapter-spanning artifact.
 * Cached per (chapter, template, difficulty, language), generated lazily
 * only when a specific set is actually requested.
 */
export async function getOrGenerateExamPaper(
  chapterId: string,
  templateId: string,
  difficulty: Difficulty,
  language: string,
): Promise<ExamPaperView> {
  const template = await prisma.examTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const templateSections = template.sections as unknown as ExamTemplateSection[];
  const totalMarks = templateSections.reduce((sum, s) => sum + s.count * s.marksEach, 0);

  const existing = await prisma.examPaper.findUnique({
    where: { chapterId_templateId_difficulty_language: { chapterId, templateId, difficulty, language } },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (existing) {
    return {
      difficulty,
      durationMinutes: template.durationMinutes,
      totalMarks,
      templateSections,
      questions: existing.questions.map(toQuestionView),
    };
  }

  // Grounding: batch-fetch every topic under the chapter and each one's
  // latest published Notes - same 3-query batching spirit as
  // getTopicStatusesByChapter in diagnostic.ts, not an N+1 loop.
  const chapter = await prisma.chapter.findUniqueOrThrow({
    where: { id: chapterId },
    include: { topics: { orderBy: { createdAt: "asc" } } },
  });
  const topicIds = chapter.topics.map((t) => t.id);
  const notesRows = await prisma.notes.findMany({
    where: { topicId: { in: topicIds }, status: "published" },
    orderBy: { createdAt: "desc" },
  });
  const notesByTopic = new Map<string, (typeof notesRows)[number]>();
  for (const n of notesRows) {
    if (!notesByTopic.has(n.topicId)) notesByTopic.set(n.topicId, n); // first hit per topic = latest (desc order)
  }

  const digest = chapter.topics
    .map((t) => {
      const notes = notesByTopic.get(t.id);
      if (!notes) return `## ${t.titleEn}\n(no notes available)`;
      const sectionsText = (notes.sections as unknown as NotesSection[]).map((s) => `${s.heading}: ${s.body}`).join("\n");
      const keyTermsText = ((notes.keyTerms as unknown as KeyTerm[] | null) ?? [])
        .map((k) => `${k.term} - ${k.meaning}`)
        .join("; ");
      return `## ${t.titleEn}\n${sectionsText}${keyTermsText ? `\nKey terms: ${keyTermsText}` : ""}`;
    })
    .join("\n\n")
    .slice(0, 30000);

  const sectionSpec = templateSections
    .map(
      (s, i) =>
        `Section ${SECTION_LETTERS[i] ?? i + 1} ("${s.label}"): exactly ${s.count} questions of kind "${s.kind}", ` +
        `${s.marksEach} mark(s) each.`,
    )
    .join("\n");

  const system = withBaseInstructions(
    "You are the Exam Paper Agent. Generate one exam paper's worth of questions for a school chapter, strictly " +
      "grounded in the chapter material given below - never invent facts beyond it. Follow the exact section " +
      "structure given, in the same order, with the exact question count and kind per section. Cover topics " +
      "from across the WHOLE chapter proportionally, not just the first one.\n" +
      `Difficulty for this paper: ${DIFFICULTY_GUIDANCE[difficulty]}\n` +
      "Kind-specific rules:\n" +
      '- "fill_blank": a sentence with a literal blank written as "___" where the missing word/phrase goes, ' +
      "plus the exact expected answer text.\n" +
      '- "true_false": an unambiguous factual statement that is either true or false, plus which one is correct ' +
      "(correctIndex 0 = True, 1 = False).\n" +
      '- "mcq": exactly 4 realistic options (one correct, three genuine wrong-answer distractors, not random ' +
      "filler), plus correctIndex.\n" +
      '- "subjective": an open-ended question, plus a concise model answer scaled to its marks value (a ' +
      "1-mark question needs a one-line answer, a 2-mark question needs 2-3 sentences).\n" +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"sections":[{"section":"A",' +
      '"questions":[{"kind":"fill_blank|true_false|mcq|subjective","text":"string",' +
      '"options":["a","b","c","d"] or null unless kind is mcq,' +
      '"correctIndex":number or null unless kind is mcq or true_false,' +
      '"correctText":"string or null unless kind is fill_blank",' +
      '"modelAnswer":"string or null unless kind is subjective"}, ...]}, ...]}.\n' +
      `Write all text in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.`,
  );

  const userContent = `Section structure to follow exactly:\n${sectionSpec}\n\nChapter material:\n${digest}`;

  const raw = await generate({ system, messages: [{ role: "user", content: userContent }], json: true });

  const parsed = extractJson<{
    sections?: {
      section?: string;
      questions?: {
        kind?: string;
        text?: string;
        options?: string[] | null;
        correctIndex?: number | null;
        correctText?: string | null;
        modelAnswer?: string | null;
      }[];
    }[];
  }>(raw);

  const kindSet = new Set<string>(["fill_blank", "true_false", "mcq", "subjective"]);
  let order = 0;
  const rows: {
    section: string;
    kind: ExamQuestionKind;
    text: string;
    options: object | undefined;
    correctIndex: number | null;
    correctText: string | null;
    modelAnswer: string | null;
    marks: number;
    order: number;
  }[] = [];

  (parsed.sections ?? []).forEach((sec, i) => {
    const templateSection = templateSections[i];
    if (!templateSection) return;
    const sectionLetter = SECTION_LETTERS[i] ?? String(i + 1);
    // Defensive: valid JSON doesn't guarantee every question has every
    // expected key, or that the model's kind label matches ours exactly -
    // same class of fix already applied to Explain beats/worked examples.
    (sec.questions ?? [])
      .filter((q) => q?.text?.trim() && q.kind && kindSet.has(q.kind))
      .forEach((q) => {
        rows.push({
          section: sectionLetter,
          kind: q.kind as ExamQuestionKind,
          text: q.text!,
          options: q.options ? (q.options as unknown as object) : undefined,
          correctIndex: q.correctIndex ?? null,
          correctText: q.correctText ?? null,
          modelAnswer: q.modelAnswer ?? null,
          marks: templateSection.marksEach,
          order: order++,
        });
      });
  });

  const examPaper = await prisma.examPaper.create({
    data: {
      chapterId,
      templateId,
      difficulty,
      language,
      questions: { createMany: { data: rows } },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  return {
    difficulty,
    durationMinutes: template.durationMinutes,
    totalMarks,
    templateSections,
    questions: examPaper.questions.map(toQuestionView),
  };
}

function toQuestionView(q: {
  id: string;
  section: string;
  kind: ExamQuestionKind;
  text: string;
  options: unknown;
  correctIndex: number | null;
  correctText: string | null;
  modelAnswer: string | null;
  marks: number;
  order: number;
}): ExamQuestionView {
  return {
    id: q.id,
    section: q.section,
    kind: q.kind,
    text: q.text,
    options: q.options as string[] | null,
    correctIndex: q.correctIndex,
    correctText: q.correctText,
    modelAnswer: q.modelAnswer,
    marks: q.marks,
    order: q.order,
  };
}
