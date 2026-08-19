import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { getContentScope } from "@pragati/shared";
import { getCurrentTeacher } from "@/lib/session-server";
import { getOrGenerateNotes } from "@/lib/agents/notes";
import { getOrGenerateExplanations } from "@/lib/agents/pedagogy";
import { getOrGenerateQuiz } from "@/lib/agents/practice";

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

    const topic = await prisma.topic.create({
      data: { chapterId: chapter.id, titleEn: title.trim() },
    });

    const source = await prisma.uploadedSource.create({
      data: {
        teacherId: teacher.id,
        schoolId: scope.schoolId,
        subjectId: subject.id,
        topicId: topic.id,
        class: cls,
        board,
        title: title.trim(),
        sourceText: sourceText.trim().slice(0, 20000),
      },
    });

    const genOptions = { sourceText: source.sourceText, status: "awaiting_review" as const };

    // Run all three agents concurrently — each is an independent Gemini
    // call, and this is well within the free-tier per-minute rate limit.
    await Promise.all([
      getOrGenerateNotes(topic.id, scope, teacher.language, { ...genOptions, sourceId: source.id }),
      getOrGenerateExplanations(topic.id, scope, teacher.language, genOptions),
      getOrGenerateQuiz(topic.id, scope, genOptions),
    ]);

    return NextResponse.json({ chapterId: chapter.id, topicId: topic.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
