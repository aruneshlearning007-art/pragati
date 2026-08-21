import { prisma, ContentStatus } from "@pragati/db";
import { generate, extractJson, withBaseInstructions, type ContentScope } from "@pragati/shared";

export interface NotesSection {
  heading: string;
  body: string;
}

export interface KeyTerm {
  term: string;
  meaning: string;
}

export interface NotesResult {
  sections: NotesSection[];
  keyTerms: KeyTerm[];
}

/**
 * Notes Agent — generic across any subject. For system-seeded topics (no
 * teacher UploadedSource), notes are generated straight from the topic's
 * own title/sub-concepts and published directly. The teacher-upload path
 * (Phase 3, `options.sourceId`/`sourceText`) grounds this in an
 * UploadedSource and gates on review instead (`options.status`). Every
 * topic — source-grounded or not — also gets a small key-terms glossary,
 * since that's a generically useful pedagogy feature, not a teacher-upload
 * specific one.
 */
export async function getOrGenerateNotes(
  topicId: string,
  scope: ContentScope,
  language: string,
  options?: { sourceId?: string; sourceText?: string; status?: ContentStatus },
): Promise<NotesResult> {
  const existing = await prisma.notes.findFirst({
    where: {
      topicId,
      board: scope.board,
      class: scope.class,
      schoolId: scope.schoolId,
      language,
      status: "published",
    },
    orderBy: { version: "desc" },
  });
  if (existing) {
    return {
      sections: existing.sections as unknown as NotesSection[],
      keyTerms: (existing.keyTerms as unknown as KeyTerm[] | null) ?? [],
    };
  }

  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { chapter: { include: { subject: true } }, subConcepts: true },
  });

  const title = language === "hi" ? topic.titleHi || topic.titleEn : topic.titleEn;
  const subjectName =
    language === "hi" ? topic.chapter.subject.nameHi || topic.chapter.subject.nameEn : topic.chapter.subject.nameEn;
  const subConceptNames = topic.subConcepts.map((s) => s.name).join(", ");

  const system = withBaseInstructions(
    "You are the Notes Agent for an Indian school learning app. Write structured study notes for one topic, " +
      "grounded in trusted, verified reference material appropriate for the class level — never invent facts. " +
      (options?.sourceText
        ? "The source chapter text provided may cover multiple topics/concepts — base the notes strictly on " +
          "the source, but write ONLY about this specific topic, ignoring parts of the source about other " +
          "concepts in the same chapter. Never invent facts beyond the source. "
        : "") +
      "Also extract 3-6 important vocabulary terms a student would need explained — words specific to this " +
      "topic that a class-appropriate student might not already know — each with a one-sentence, simple " +
      "meaning in their own words (not a dictionary definition). " +
      'Respond ONLY with strict JSON, no markdown, no commentary, no code fences. Shape: {"sections":' +
      '[{"heading":"string","body":"string"}], "keyTerms":[{"term":"string","meaning":"string"}]} with 3-5 ' +
      "sections and 3-6 key terms. " +
      `Write all text in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.`,
  );

  const userContent = options?.sourceText
    ? `Subject: ${subjectName}\nTopic: ${title}\nBoard: ${scope.board}, ${scope.class}\nSub-concepts to cover: ${subConceptNames || "(none specified)"}\n\nSource chapter text:\n${options.sourceText.slice(0, 30000)}`
    : `Subject: ${subjectName}\nTopic: ${title}\nBoard: ${scope.board}, ${scope.class}\nSub-concepts to cover: ${subConceptNames || "(none specified)"}`;

  const raw = await generate({
    system,
    messages: [{ role: "user", content: userContent }],
    json: true,
  });

  const parsed = extractJson<{ sections?: NotesSection[]; keyTerms?: KeyTerm[] }>(raw);
  // The model is instructed to always include these, but "valid JSON" and
  // "has every expected key" are two separate guarantees — falling back to
  // empty rather than trusting the shape blindly turns a missing key into
  // thin content instead of a crash that discards the whole concept.
  const sections = parsed.sections ?? [];
  const keyTerms = parsed.keyTerms ?? [];

  await prisma.notes.create({
    data: {
      topicId,
      sourceId: options?.sourceId,
      board: scope.board,
      class: scope.class,
      schoolId: scope.schoolId,
      language,
      sections: sections as unknown as object,
      keyTerms: keyTerms as unknown as object,
      status: options?.status ?? "published",
    },
  });

  return { sections, keyTerms };
}
