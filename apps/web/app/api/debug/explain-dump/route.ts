import { NextResponse } from "next/server";
import { prisma } from "@pragati/db";

// Temporary debug-only route to inspect raw Explanation rows while chasing
// a live crash — not gated beyond obscurity, deleted right after use.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const chapterId = url.searchParams.get("chapterId");
  if (!chapterId) return NextResponse.json({ error: "chapterId required" }, { status: 400 });

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId }, include: { topics: true } });
  if (!chapter) return NextResponse.json({ error: "not found" }, { status: 404 });

  const explanations = await prisma.explanation.findMany({
    where: { topicId: { in: chapter.topics.map((t) => t.id) } },
  });

  return NextResponse.json({ explanations });
}
