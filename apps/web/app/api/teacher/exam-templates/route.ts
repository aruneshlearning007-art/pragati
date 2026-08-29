import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { getCurrentTeacher } from "@/lib/session-server";
import type { ExamTemplateSection } from "@/lib/agents/examPaper";

export async function GET(req: NextRequest) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId");
  const cls = searchParams.get("class");
  const board = searchParams.get("board");
  if (!subjectId || !cls || !board) {
    return NextResponse.json({ error: "subjectId, class, board required" }, { status: 400 });
  }

  // findUnique's compound-key input requires a definite string for schoolId
  // even though the column is nullable (a Prisma limitation around NULL in
  // compound unique lookups) — findFirst has no such restriction and is all
  // a read needs here.
  const template = await prisma.examTemplate.findFirst({
    where: { subjectId, class: cls, board, schoolId: teacher.schoolId },
  });

  return NextResponse.json({ template });
}

export async function POST(req: NextRequest) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // Every real teacher account has a school from onboarding — this guards
  // the (should-never-happen) case so the compound-unique upsert below can
  // use a definite string, which Prisma's generated type requires.
  if (!teacher.schoolId) {
    return NextResponse.json({ error: "Your account has no school set." }, { status: 400 });
  }
  const schoolId = teacher.schoolId;

  const body = await req.json();
  const { subjectId, cls, board, durationMinutes, sections, publish } = body as {
    subjectId: string;
    cls: string;
    board: string;
    durationMinutes: number;
    sections: ExamTemplateSection[];
    publish: boolean;
  };

  if (!subjectId || !cls || !board || !durationMinutes || !Array.isArray(sections) || sections.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const template = await prisma.examTemplate.upsert({
    where: { subjectId_class_board_schoolId: { subjectId, class: cls, board, schoolId } },
    update: {
      durationMinutes,
      sections: sections as unknown as object,
      isPublished: !!publish,
      teacherId: teacher.id,
    },
    create: {
      teacherId: teacher.id,
      subjectId,
      class: cls,
      board,
      schoolId,
      durationMinutes,
      sections: sections as unknown as object,
      isPublished: !!publish,
    },
  });

  // Any edit invalidates previously-cached exam papers for this template —
  // no versioning, same "just delete and regenerate" precedent as
  // DeleteChapterButton. No schema relation cascades on delete in this app,
  // so ExamQuestion rows must be removed before their parent ExamPaper.
  const stale = await prisma.examPaper.findMany({ where: { templateId: template.id }, select: { id: true } });
  const staleIds = stale.map((p) => p.id);
  if (staleIds.length > 0) {
    await prisma.$transaction([
      prisma.examQuestion.deleteMany({ where: { examPaperId: { in: staleIds } } }),
      prisma.examPaper.deleteMany({ where: { id: { in: staleIds } } }),
    ]);
  }

  return NextResponse.json({ template });
}
