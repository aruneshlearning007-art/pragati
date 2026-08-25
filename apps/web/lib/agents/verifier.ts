import { prisma } from "@pragati/db";
import { generate, extractJson, withBaseInstructions } from "@pragati/shared";
import type { NotesSection } from "./notes";
import type { ExplainVariant, ExplainBeat, DiagramStep } from "./pedagogy";
import { checkArithmetic } from "./arithmetic-checker";

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
      " The story/real-world/go-further entries have a \"beats\" array (each with a short label and 1-2 " +
      "sentences of text) instead of one body paragraph — check and correct each beat's text the same way you " +
      "would body text, keeping the same labels unless a label itself is wrong. The picture-mode entry has a " +
      "\"diagram\" with ordered steps and connector labels between them instead of a body paragraph — check and " +
      "correct the steps/connectors the same way you would body text. The " +
      "worked-mode entry has a \"workedExample\" with a problem, step-by-step reasoning, and calculations " +
      "instead of a body paragraph — verify each step's arithmetic actually computes to what's claimed and " +
      "that the final answer is correct, correcting exactly like body text. " +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"variants":[{"mode":"story|picture|' +
      'realworld|gofurther|worked","body":"string","beats":[{"label":"string","text":"string"}] or null unless ' +
      'mode is story/realworld/gofurther,"diagram":{"steps":[{"icon":"emoji","label":"string",' +
      '"description":"string"}],"connectors":["string"]} or null unless mode is picture,' +
      '"workedExample":{"problem":"string","steps":[{"explanation":"string","work":"string"}],' +
      '"answer":"string"} or null unless mode is worked}],' +
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
  correctIndex: number | null;
  correctValue: number | null;
  tolerance: number | null;
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
      "with a wrong answer key is worse than no quiz. For kind \"numeric\" questions, options is empty and " +
      "there is no correctIndex — instead verify correctValue is the actual right numeric answer (re-compute " +
      "it yourself) and tolerance is a reasonable rounding margin, correcting either if the arithmetic is " +
      "wrong. Keep the same number of questions in the same order. " +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"questions":[{"kind":"string",' +
      '"text":"string","options":["string"],"correctIndex":number or null,"correctValue":number or null,' +
      '"tolerance":number or null,"imageLabel":"string or null"}],' +
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
    let finalSections = notes.sections as unknown as NotesSection[];
    try {
      const { sections, flags } = await verifyNotes(finalSections, sourceText, cls, language);
      if (flags.length > 0) {
        await prisma.notes.update({ where: { id: notes.id }, data: { sections: sections as unknown as object } });
        allFlags.push(...flags.map((f) => ({ section: "notes" as const, ...f })));
      }
      finalSections = sections;
    } catch (err) {
      console.error("Verifier: notes check failed, keeping unverified draft", err);
    }
    // Deterministic double-check on the final (possibly LLM-corrected)
    // content — catches real calculation mistakes the LLM verifier missed.
    const arithmeticFlags = finalSections.flatMap((s) => checkArithmetic(s.body));
    allFlags.push(...arithmeticFlags.map((f) => ({ section: "notes" as const, ...f })));
  }

  if (explanations.length > 0) {
    let finalVariants: ExplainVariant[] = explanations.map((e) => ({
      mode: e.mode,
      body: e.body,
      beats: e.beats as unknown as ExplainBeat[] | null,
      diagram: e.diagram as unknown as ExplainVariant["diagram"],
      workedExample: e.workedExample as unknown as ExplainVariant["workedExample"],
      visual: e.graph as unknown as ExplainVariant["visual"],
    }));
    try {
      const { variants, flags } = await verifyExplanations(finalVariants, sourceText, cls, language);
      // The model occasionally omits body for the picture-mode variant when
      // it only had a diagram fix to make — fall back to the original
      // rather than treating "no body returned" as "the body should be
      // cleared". Applied here (not just at the DB write below) so the
      // arithmetic double-check afterward never sees a null body either.
      // Same fallback for beats, since a fix to only one beat's text still
      // needs the model to echo back the rest of the array — an empty/
      // missing beats array is treated as "nothing to change" instead of
      // "the beats should be cleared". The Verifier's own JSON schema
      // doesn't ask it to re-check "visual" (a math-accuracy re-derivation
      // isn't in scope here), so its response never carries one back —
      // always keep the original.
      const normalized = variants.map((v) => {
        const original = explanations.find((e) => e.mode === v.mode);
        return original
          ? {
              ...v,
              body: v.body || original.body,
              beats: v.beats && v.beats.length > 0 ? v.beats : (original.beats as unknown as ExplainBeat[] | null),
              visual: original.graph as unknown as ExplainVariant["visual"],
            }
          : v;
      });
      if (flags.length > 0) {
        await Promise.all(
          normalized.map((v) => {
            const original = explanations.find((e) => e.mode === v.mode);
            if (!original) return Promise.resolve();
            return prisma.explanation.update({
              where: { id: original.id },
              data: {
                body: v.body,
                beats: v.beats ? (v.beats as unknown as object) : undefined,
                diagram: v.diagram ? (v.diagram as unknown as object) : undefined,
                workedExample: v.workedExample ? (v.workedExample as unknown as object) : undefined,
              },
            });
          }),
        );
        allFlags.push(...flags.map((f) => ({ section: "explain" as const, ...f })));
      }
      finalVariants = normalized;
    } catch (err) {
      console.error("Verifier: explain check failed, keeping unverified draft", err);
    }
    // Deterministic double-check, including worked-example steps and beat
    // text — this is exactly where a live-tested Gemini arithmetic mistake
    // would get caught even if the LLM verifier missed it.
    const arithmeticFlags = finalVariants.flatMap((v) => {
      const workedText = v.workedExample ? v.workedExample.steps.map((s) => s.work).join("\n") : "";
      const beatsText = v.beats ? v.beats.map((b) => b.text).join("\n") : "";
      return [...checkArithmetic(v.body), ...checkArithmetic(workedText), ...checkArithmetic(beatsText)];
    });
    allFlags.push(...arithmeticFlags.map((f) => ({ section: "explain" as const, ...f })));
  }

  if (questions.length > 0) {
    let finalQuestions: QuizQuestionDraft[] = questions.map((q) => ({
      kind: q.kind,
      text: q.text,
      options: q.options as unknown as string[],
      correctIndex: q.correctIndex,
      correctValue: q.correctValue,
      tolerance: q.tolerance,
      imageLabel: q.imageLabel,
    }));
    try {
      const { questions: corrected, flags } = await verifyQuiz(finalQuestions, sourceText, cls, language);
      if (flags.length > 0 && corrected.length === questions.length) {
        await Promise.all(
          corrected.map((q, i) =>
            prisma.quizQuestion.update({
              where: { id: questions[i].id },
              data: {
                text: q.text,
                options: q.options as unknown as object,
                correctIndex: q.correctIndex,
                correctValue: q.correctValue,
                tolerance: q.tolerance ?? 0,
                imageLabel: q.imageLabel,
              },
            }),
          ),
        );
        allFlags.push(...flags.map((f) => ({ section: "practice" as const, ...f })));
      }
      if (corrected.length === questions.length) finalQuestions = corrected;
    } catch (err) {
      console.error("Verifier: practice check failed, keeping unverified draft", err);
    }
    const arithmeticFlags = finalQuestions.flatMap((q) => checkArithmetic([q.text, ...q.options].join("\n")));
    allFlags.push(...arithmeticFlags.map((f) => ({ section: "practice" as const, ...f })));
  }

  // The model occasionally returns a flags-array entry missing quote/reason
  // (both required columns) — drop those rather than letting one bad entry
  // crash the whole batch insert and, with it, the concept generation
  // request that already has genuinely valid content saved.
  const validFlags = allFlags.filter((f) => f.quote && f.reason);
  if (validFlags.length > 0) {
    try {
      await prisma.verifierFlag.createMany({
        data: validFlags.map((f) => ({ chapterId, topicId, section: f.section, quote: f.quote, reason: f.reason })),
      });
    } catch (err) {
      console.error("Verifier: failed to save flags, corrections were still applied", err);
    }
  }
}
