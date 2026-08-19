import { prisma, ContentStatus } from "@pragati/db";
import { generate, extractJson, withBaseInstructions, type ContentScope } from "@pragati/shared";

export interface NotesSection {
  heading: string;
  body: string;
}

/**
 * Notes Agent — generic across any subject. For system-seeded topics (no
 * teacher UploadedSource), notes are generated straight from the topic's
 * own title/sub-concepts and published directly. The teacher-upload path
 * (Phase 3, `options.sourceId`/`sourceText`) grounds this in an
 * UploadedSource and gates on review instead (`options.status`).
 */
export async function getOrGenerateNotes(
  topicId: string,
  scope: ContentScope,
  language: string,
  options?: { sourceId?: string; sourceText?: string; status?: ContentStatus },
): Promise<NotesSection[]> {
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
    return existing.sections as unknown as NotesSection[];
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
        ? "Base the notes strictly on the source chapter text provided — never invent facts beyond it. "
        : "") +
      'Respond ONLY with strict JSON, no markdown, no commentary, no code fences. Shape: {"sections":' +
      '[{"heading":"string","body":"string"}]} with 3-5 sections. ' +
      `Write all text in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.`,
  );

  const userContent = options?.sourceText
    ? `Subject: ${subjectName}\nTopic: ${title}\nBoard: ${scope.board}, ${scope.class}\nSub-concepts to cover: ${subConceptNames || "(none specified)"}\n\nSource chapter text:\n${options.sourceText.slice(0, 12000)}`
    : `Subject: ${subjectName}\nTopic: ${title}\nBoard: ${scope.board}, ${scope.class}\nSub-concepts to cover: ${subConceptNames || "(none specified)"}`;

  const raw = await generate({
    system,
    messages: [{ role: "user", content: userContent }],
    json: true,
  });

  const parsed = extractJson<{ sections: NotesSection[] }>(raw);

  await prisma.notes.create({
    data: {
      topicId,
      sourceId: options?.sourceId,
      board: scope.board,
      class: scope.class,
      schoolId: scope.schoolId,
      language,
      sections: parsed.sections as unknown as object,
      status: options?.status ?? "published",
    },
  });

  return parsed.sections;
}
