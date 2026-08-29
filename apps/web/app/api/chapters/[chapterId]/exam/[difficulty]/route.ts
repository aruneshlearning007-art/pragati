import { NextRequest, NextResponse } from "next/server";
import { prisma, Difficulty } from "@pragati/db";
import { getCurrentStudent, getCurrentTeacher } from "@/lib/session-server";
import { getOrGenerateExamPaper } from "@/lib/agents/examPaper";
import { renderQuestionPaperPdf, renderAnswerKeyPdf } from "@/lib/pdf/examPaperPdf";

const DIFFICULTY_SET: Record<string, Difficulty> = { easy: "easy", medium: "medium", hard: "hard" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ chapterId: string; difficulty: string }> }) {
  const student = await getCurrentStudent();
  const teacher = student ? null : await getCurrentTeacher();
  if (!student && !teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { chapterId, difficulty: difficultyParam } = await params;
  const difficulty = DIFFICULTY_SET[difficultyParam];
  if (!difficulty) return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "answerkey" ? "answerkey" : "question";
  const language = (student ?? teacher!).language ?? "en";

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId }, include: { subject: true } });
  if (!chapter) return NextResponse.json({ error: "Chapter not found" }, { status: 404 });

  const schoolId = student ? student.schoolId : teacher!.schoolId;
  // findFirst rather than findUnique — the compound-key lookup requires a
  // definite string for the nullable schoolId column.
  const template = await prisma.examTemplate.findFirst({
    where: { subjectId: chapter.subjectId, class: chapter.class, board: chapter.board, schoolId },
  });
  if (!template || !template.isPublished) {
    return NextResponse.json({ error: "No published exam format for this subject/class yet" }, { status: 404 });
  }

  try {
    const paper = await getOrGenerateExamPaper(chapterId, template.id, difficulty, language);
    const pdfParams = {
      paper,
      chapterTitle: chapter.titleEn,
      subjectName: chapter.subject.nameEn,
      studentClass: chapter.class,
      board: chapter.board,
    };
    const buffer = type === "answerkey" ? await renderAnswerKeyPdf(pdfParams) : await renderQuestionPaperPdf(pdfParams);

    const filename = `${chapter.titleEn.replace(/[^a-z0-9]+/gi, "-")}-${difficultyParam}-${type}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
