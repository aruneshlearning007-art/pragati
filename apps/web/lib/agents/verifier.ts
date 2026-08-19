import { prisma } from "@pragati/db";
import { generate, extractJson, withBaseInstructions } from "@pragati/shared";
import type { NotesSection } from "./notes";
import type { ExplainVariant, DiagramStep } from "./pedagogy";

export interface VerifierFlagView {
  quote: string;
  reason: string;
}

const VERIFIER_TASK =
  "You are the Verifier Agent. You are given draft content, the original source chapter text it was supposed " +
  "to be grounded in, and the target class level. Check two things: (1) every factual claim in the draft is " +
  "actually supported by the source — if something was invented or isn't in the source, it's a hallucination " +
  "and must be corrected or removed; (2) the language, vocabulary, and complexity genuinely fit the target " +
  "class level — simplify anything too advanced, add substance to anything too thin. " +
  "If you find and fix a problem, add one entry to \"flags\" per fix: \"quote\" is the corrected text (what it " +
  "now says, not what it used to say) and \"reason\" is one short sentence explaining what was wrong. " +
  "If the draft has no problems, return it completely unchanged and an empty flags array — do not invent " +
  "issues just to have something to report.";

/** Verify + auto-correct Notes sections against the source chapter and class level. */
export async function verifyNotes(
  sections: NotesSection[],
  sourceText: string,
  cls: string,
  language: string,
): Promise<{ sections: NotesSection[]; flags: VerifierFlagView[] }> {
  const system = withBaseInstructions(
    VERIFIER_TASK +
      ' Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"sections":' +
      '[{"heading":"string","body":"string"}],"flags":[{"quote":"string","reason":"string"}]}. ' +
      `Text must stay in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.`,
  );

  const raw = await generate({
    system,
    messages: [
      {
        role: "user",
        content: `Class: ${cls}\n\nSource chapter text:\n${sourceText.slice(0, 30000)}\n\nDraft notes:\n${JSON.stringify(sections)}`,
      },
    ],
    json: true,
  });

  return extractJson<{ sections: NotesSection[]; flags: VerifierFlagView[] }>(raw);
}

/** Verify + auto-correct the four Explain variants (including the Picture-mode diagram). */
export async function verifyExplanations(
  variants: ExplainVariant[],
  sourceText: string,
  cls: string,
  language: string,
): Promise<{ variants: ExplainVariant[]; flags: VerifierFlagView[] }> {
  const system = withBaseInstructions(
    VERIFIER_TASK +
      " The picture-mode entry has a \"diagram\" with ordered steps and connector labels between them instead " +
      "of a body paragraph — check and correct the steps/connectors the same way you would body text. " +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"variants":[{"mode":"story|picture|' +
      'realworld|gofurther","body":"string","diagram":{"steps":[{"icon":"emoji","label":"string",' +
      '"description":"string"}],"connectors":["string"]} or null for non-picture modes}],' +
      '"flags":[{"quote":"string","reason":"string"}]}. ' +
      `Text must stay in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.`,
  );

  const raw = await generate({
    system,
    messages: [
      {
        role: "user",
        content: `Class: ${cls}\n\nSource chapter text:\n${sourceText.slice(0, 30000)}\n\nDraft variants:\n${JSON.stringify(variants)}`,
      },
    ],
    json: true,
  });

  return extractJson<{ variants: ExplainVariant[]; flags: VerifierFlagView[] }>(raw);
}

export interface QuizQuestionDraft {
  kind: string;
  text: string;
  options: string[];
  correctIndex: number;
  imageLabel: string | null;
}

/** Verify + auto-correct quiz questions. Preserves array order so answer keys stay aligned. */
export async function verifyQuiz(
  questions: QuizQuestionDraft[],
  sourceText: string,
  cls: string,
  language: string,
): Promise<{ questions: QuizQuestionDraft[]; flags: VerifierFlagView[] }> {
  const system = withBaseInstructions(
    VERIFIER_TASK +
      " Also double-check correctIndex genuinely points at the right option after any edit you make — a quiz " +
      "with a wrong answer key is worse than no quiz. Keep the same number of questions in the same order. " +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"questions":[{"kind":"string",' +
      '"text":"string","options":["string"],"correctIndex":0,"imageLabel":"string or null"}],' +
      '"flags":[{"quote":"string","reason":"string"}]}. ' +
      `Text must stay in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.`,
  );

  const raw = await generate({
    system,
    messages: [
      {
        role: "user",
        content: `Class: ${cls}\n\nSource chapter text:\n${sourceText.slice(0, 30000)}\n\nDraft questions:\n${JSON.stringify(questions)}`,
      },
    ],
    json: true,
  });

  return extractJson<{ questions: QuizQuestionDraft[]; flags: VerifierFlagView[] }>(raw);
}

// Re-exported so callers don't need a separate import just for the type.
export type { DiagramStep };

/**
 * Runs after Notes/Pedagogy/Practice generation for a teacher-uploaded
 * chapter: fetches the just-generated draft rows for the topic, verifies +
 * auto-corrects each against the source text and class level, writes any
 * corrections back over the draft rows (still `awaiting_review` — this
 * never touches `status`), and stores one VerifierFlag row per fix so the
 * teacher review page can show exactly what changed. Only ever called for
 * the teacher-upload path; system auto-generated content is never verified.
 */
export async function verifyAndCorrectChapter(
  chapterId: string,
  topicId: string,
  sourceText: string,
  cls: string,
  language: string,
): Promise<void> {
  const [notes, explanations, questions] = await Promise.all([
    prisma.notes.findFirst({ where: { topicId }, orderBy: { createdAt: "desc" } }),
    prisma.explanation.findMany({ where: { topicId } }),
    prisma.quizQuestion.findMany({ where: { topicId } }),
  ]);

  const allFlags: { section: "notes" | "explain" | "practice"; quote: string; reason: string }[] = [];

  // Each section's verification is independently best-effort: the model
  // occasionally returns malformed JSON (seen live: an over-escaped
  // response that fails to parse), and a parsing failure in one section
  // must not discard the other two sections' corrections, and definitely
  // must not throw away the base Notes/Explain/Practice content that was
  // already generated and saved before this function ever ran — a skipped
  // verification just means that section keeps its unverified draft
  // instead of losing the whole concept.

  if (notes) {
    try {
      const { sections, flags } = await verifyNotes(notes.sections as unknown as NotesSection[], sourceText, cls, language);
      if (flags.length > 0) {
        await prisma.notes.update({ where: { id: notes.id }, data: { sections: sections as unknown as object } });
        allFlags.push(...flags.map((f) => ({ section: "notes" as const, ...f })));
      }
    } catch (err) {
      console.error("Verifier: notes check failed, keeping unverified draft", err);
    }
  }

  if (explanations.length > 0) {
    try {
      const draftVariants: ExplainVariant[] = explanations.map((e) => ({
        mode: e.mode,
        body: e.body,
        diagram: e.diagram as unknown as ExplainVariant["diagram"],
      }));
      const { variants, flags } = await verifyExplanations(draftVariants, sourceText, cls, language);
      if (flags.length > 0) {
        await Promise.all(
          variants.map((v) => {
            const original = explanations.find((e) => e.mode === v.mode);
            if (!original) return Promise.resolve();
            // The model occasionally omits body for the picture-mode variant
            // when it only had a diagram fix to make — fall back to the
            // original rather than writing a null body (Prisma rejects it,
            // and it would also just be wrong: "no body returned" isn't the
            // same as "the body should be cleared").
            return prisma.explanation.update({
              where: { id: original.id },
              data: { body: v.body || original.body, diagram: v.diagram ? (v.diagram as unknown as object) : undefined },
            });
          }),
        );
        allFlags.push(...flags.map((f) => ({ section: "explain" as const, ...f })));
      }
    } catch (err) {
      console.error("Verifier: explain check failed, keeping unverified draft", err);
    }
  }

  if (questions.length > 0) {
    try {
      const draftQuestions: QuizQuestionDraft[] = questions.map((q) => ({
        kind: q.kind,
        text: q.text,
        options: q.options as unknown as string[],
        correctIndex: q.correctIndex,
        imageLabel: q.imageLabel,
      }));
      const { questions: corrected, flags } = await verifyQuiz(draftQuestions, sourceText, cls, language);
      if (flags.length > 0 && corrected.length === questions.length) {
        await Promise.all(
          corrected.map((q, i) =>
            prisma.quizQuestion.update({
              where: { id: questions[i].id },
              data: { text: q.text, options: q.options as unknown as object, correctIndex: q.correctIndex, imageLabel: q.imageLabel },
            }),
          ),
        );
        allFlags.push(...flags.map((f) => ({ section: "practice" as const, ...f })));
      }
    } catch (err) {
      console.error("Verifier: practice check failed, keeping unverified draft", err);
    }
  }

  if (allFlags.length > 0) {
    await prisma.verifierFlag.createMany({
      data: allFlags.map((f) => ({ chapterId, topicId, section: f.section, quote: f.quote, reason: f.reason })),
    });
  }
}
