import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { getContentScope } from "@pragati/shared";
import { getCurrentTeacher } from "@/lib/session-server";
import { getOrGenerateNotes } from "@/lib/agents/notes";
import { getOrGenerateExplanations } from "@/lib/agents/pedagogy";
import { getOrGenerateQuiz } from "@/lib/agents/practice";
import { verifyAndCorrectChapter } from "@/lib/agents/verifier";
import { segmentIntoConcepts } from "@/lib/agents/segmentation";

// Segmenting a chapter into several concepts and generating + verifying
// each one sequentially (see POST below) can take a few minutes for a long
// real-world chapter — well past the platform default.
export const maxDuration = 300;

export async function GET() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const chapters = await prisma.chapter.findMany({
    where: { teacherId: teacher.id },
    include: { subject: true, topics: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    chapters: chapters.map((c) => ({
      id: c.id,
      title: c.titleEn,
      subject: c.subject.nameEn,
      class: c.class,
      board: c.board,
      status: c.status,
      topicId: c.topics[0]?.id ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json();
  const { subjectId, newSubjectName, cls, board, title, sourceText } = body as {
    subjectId: string | null;
    newSubjectName: string | null;
    cls: string;
    board: string;
    title: string;
    sourceText: string;
  };

  if (!title?.trim() || !sourceText?.trim() || !cls || !board) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!subjectId && !newSubjectName?.trim()) {
    return NextResponse.json({ error: "Choose or name a subject" }, { status: 400 });
  }

  try {
    const subject = subjectId
      ? await prisma.subject.findUniqueOrThrow({ where: { id: subjectId } })
      : await prisma.subject.upsert({
          where: { nameEn: newSubjectName!.trim() },
          update: {},
          create: { nameEn: newSubjectName!.trim() },
        });

    const scope = getContentScope({ studentClass: cls, board, schoolId: teacher.schoolId });

    const chapter = await prisma.chapter.create({
      data: {
        subjectId: subject.id,
        titleEn: title.trim(),
        class: cls,
        board,
        schoolId: scope.schoolId,
        teacherId: teacher.id,
        status: "awaiting_review",
      },
    });

    // No single Topic maps to the whole chapter's source once it's split
    // into concepts below — each concept's Notes row links back to this
    // same UploadedSource via sourceId instead.
    const source = await prisma.uploadedSource.create({
      data: {
        teacherId: teacher.id,
        schoolId: scope.schoolId,
        subjectId: subject.id,
        topicId: null,
        class: cls,
        board,
        title: title.trim(),
        sourceText: sourceText.trim(),
      },
    });

    const concepts = await segmentIntoConcepts(source.sourceText, subject.nameEn, cls, teacher.language);

    // Concepts are processed one at a time rather than in parallel: each
    // concept already fires 3 concurrent Gemini calls (Notes/Explain/
    // Practice) plus a sequential Verifier call, so doing all concepts at
    // once could burst well past the free-tier per-minute quota on a
    // chapter with several concepts. Sequential keeps peak concurrency
    // constant regardless of chapter size.
    for (const concept of concepts) {
      const topic = await prisma.topic.create({
        data: { chapterId: chapter.id, titleEn: concept.title },
      });

      if (concept.subConcepts.length > 0) {
        await prisma.subConcept.createMany({
          data: concept.subConcepts.map((name) => ({ topicId: topic.id, name })),
        });
      }

      const genOptions = { sourceText: source.sourceText, status: "awaiting_review" as const };

      await Promise.all([
        getOrGenerateNotes(topic.id, scope, teacher.language, { ...genOptions, sourceId: source.id }),
        getOrGenerateExplanations(topic.id, scope, teacher.language, genOptions),
        getOrGenerateQuiz(topic.id, scope, genOptions),
      ]);

      // Verifier runs after generation, not concurrently with it — it needs
      // to read back what was actually written to the DB.
      await verifyAndCorrectChapter(chapter.id, topic.id, source.sourceText, cls, teacher.language);
    }

    return NextResponse.json({ chapterId: chapter.id, conceptCount: concepts.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
