import { NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { getCurrentTeacher } from "@/lib/session-server";

export async function POST(_req: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { chapterId } = await params;
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId }, include: { topics: true } });
  if (!chapter || chapter.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const topicIds = chapter.topics.map((t) => t.id);

  await prisma.$transaction([
    prisma.chapter.update({ where: { id: chapterId }, data: { status: "published" } }),
    prisma.notes.updateMany({ where: { topicId: { in: topicIds }, status: "awaiting_review" }, data: { status: "published" } }),
    prisma.explanation.updateMany({ where: { topicId: { in: topicIds }, status: "awaiting_review" }, data: { status: "published" } }),
    prisma.quizQuestion.updateMany({ where: { topicId: { in: topicIds }, status: "awaiting_review" }, data: { status: "published" } }),
  ]);

  return NextResponse.json({ ok: true });
}
