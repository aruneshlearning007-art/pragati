import { NextRequest, NextResponse } from "next/server";
import { getContentScope } from "@pragati/shared";
import { getCurrentStudent } from "@/lib/session-server";
import { getOrGenerateQuiz } from "@/lib/agents/practice";
import { submitQuizAnswers } from "@/lib/agents/diagnostic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { topicId } = await params;
  const scope = getContentScope({
    studentClass: student.class ?? "Class 6",
    board: student.board ?? "CBSE",
    schoolId: student.schoolId,
  });

  const questions = await getOrGenerateQuiz(topicId, scope);
  return NextResponse.json({ questions });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { topicId } = await params;
  const { answers } = (await req.json()) as { answers: Record<string, number> };

  const result = await submitQuizAnswers(student.id, topicId, answers);
  return NextResponse.json(result);
}
