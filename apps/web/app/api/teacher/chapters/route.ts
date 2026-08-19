import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { getContentScope } from "@pragati/shared";
import { getCurrentTeacher } from "@/lib/session-server";
import { segmentIntoConcepts } from "@/lib/agents/segmentation";

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

    // Segmentation is a single Gemini call, fast regardless of chapter
    // length — actual per-concept content generation happens one request
    // at a time via POST /api/teacher/chapters/[chapterId]/concepts,
    // driven by the client in a loop. Doing all of it here in one request
    // was tried first and, live-tested, real chapters with several
    // concepts took well past any reasonable serverless function timeout
    // (each concept's Notes+Explain+Practice+Verifier sequence took several
    // minutes, not the ~30-45s assumed) — splitting into one request per
    // concept keeps each request fast and lets the teacher see real
    // progress instead of staring at a spinner that might silently die.
    const concepts = await segmentIntoConcepts(source.sourceText, subject.nameEn, cls, teacher.language);

    return NextResponse.json({ chapterId: chapter.id, sourceId: source.id, concepts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
