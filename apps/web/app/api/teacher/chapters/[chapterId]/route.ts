import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { getCurrentTeacher } from "@/lib/session-server";

// Lets a teacher remove a chapter they created — whether it's still
// awaiting_review (e.g. a botched or partially-generated upload they want
// to redo from scratch) or already published — so they can re-upload
// clean. No relation in the schema cascades on delete, so this walks the
// full dependency tree by hand in one transaction, deepest first, before
// removing the Chapter row itself.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { chapterId } = await params;
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter || chapter.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const topics = await prisma.topic.findMany({ where: { chapterId }, select: { id: true } });
  const topicIds = topics.map((t) => t.id);

  const subConcepts = await prisma.subConcept.findMany({
    where: { topicId: { in: topicIds } },
    select: { id: true },
  });
  const subConceptIds = subConcepts.map((s) => s.id);

  const questions = await prisma.quizQuestion.findMany({
    where: { topicId: { in: topicIds } },
    select: { id: true },
  });
  const questionIds = questions.map((q) => q.id);

  // UploadedSource has no direct link to Chapter — one is created per
  // chapter upload and shared across all its concepts via Notes.sourceId
  // (topicId on UploadedSource itself stays null, see the comment in
  // POST /api/teacher/chapters) — so the only way to find it is through
  // the Notes rows about to be deleted, collected first.
  const notesRows = await prisma.notes.findMany({
    where: { topicId: { in: topicIds } },
    select: { sourceId: true },
  });
  const sourceIds = [...new Set(notesRows.map((n) => n.sourceId).filter((id): id is string => !!id))];

  try {
    await prisma.$transaction([
      prisma.quizAttempt.deleteMany({ where: { questionId: { in: questionIds } } }),
      prisma.masteryScore.deleteMany({ where: { subConceptId: { in: subConceptIds } } }),
      prisma.misconceptionTag.deleteMany({ where: { subConceptId: { in: subConceptIds } } }),
      prisma.quizQuestion.deleteMany({ where: { topicId: { in: topicIds } } }),
      prisma.subConcept.deleteMany({ where: { topicId: { in: topicIds } } }),
      prisma.explanation.deleteMany({ where: { topicId: { in: topicIds } } }),
      prisma.notes.deleteMany({ where: { topicId: { in: topicIds } } }),
      prisma.video.deleteMany({ where: { topicId: { in: topicIds } } }),
      prisma.doubtMessage.deleteMany({ where: { topicId: { in: topicIds } } }),
      prisma.selfExplanation.deleteMany({ where: { topicId: { in: topicIds } } }),
      prisma.verifierFlag.deleteMany({ where: { chapterId } }),
      prisma.uploadedSource.deleteMany({ where: { id: { in: sourceIds } } }),
      prisma.topic.deleteMany({ where: { chapterId } }),
      prisma.chapter.delete({ where: { id: chapterId } }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
