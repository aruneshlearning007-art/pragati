import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { getContentScope } from "@pragati/shared";
import { getCurrentTeacher } from "@/lib/session-server";
import { getOrGenerateNotes } from "@/lib/agents/notes";
import { getOrGenerateExplanations } from "@/lib/agents/pedagogy";
import { getOrGenerateQuiz } from "@/lib/agents/practice";
import { verifyAndCorrectChapter } from "@/lib/agents/verifier";

// One concept's full generation (Notes + Explain + Practice, then Verifier)
// per request — the client calls this once per concept returned by the
// initial POST /api/teacher/chapters, in a loop. Keeps each request well
// under any serverless timeout regardless of how many concepts a chapter
// has, and lets the teacher see real per-concept progress.
// Raised from 90 -> 180 after a real "Vercel Runtime Timeout Error: Task
// timed out after 90 seconds" live on this exact route (founder-reported,
// then reproduced) — a single concept's Notes+Explain+Practice+Verifier
// sequence occasionally runs past 90s. 180 gives real headroom; the
// account's plan already proved capable of running at least 90s (the
// timeout fired at exactly the configured value, not some lower plan
// ceiling), so raising the code's own limit should raise the effective one.
export const maxDuration = 180;

export async function POST(req: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { chapterId } = await params;
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter || chapter.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { sourceId, title, subConcepts } = body as { sourceId: string; title: string; subConcepts: string[] };
  if (!sourceId || !title?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const source = await prisma.uploadedSource.findUniqueOrThrow({ where: { id: sourceId } });
    const scope = getContentScope({ studentClass: chapter.class, board: chapter.board, schoolId: teacher.schoolId });

    const topic = await prisma.topic.create({
      data: { chapterId: chapter.id, titleEn: title.trim() },
    });

    if (subConcepts?.length > 0) {
      await prisma.subConcept.createMany({
        data: subConcepts.map((name) => ({ topicId: topic.id, name })),
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
    await verifyAndCorrectChapter(chapter.id, topic.id, source.sourceText, chapter.class, teacher.language);

    return NextResponse.json({ topicId: topic.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
