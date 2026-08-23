import { NextRequest, NextResponse } from "next/server";
import { getContentScope } from "@pragati/shared";
import { getCurrentStudent } from "@/lib/session-server";
import { getSelfExplanationHistory, explainAndGetFeedback } from "@/lib/agents/selfExplain";
import { isDoubtChatDisabled } from "@/lib/agents/doubt";
import type { Language } from "@/lib/i18n";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { topicId } = await params;
  const [history, disabled] = await Promise.all([
    getSelfExplanationHistory(student.id, topicId),
    isDoubtChatDisabled(student.id),
  ]);
  return NextResponse.json({ history, disabled });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { topicId } = await params;
  const { explanation } = (await req.json()) as { explanation: string };
  if (!explanation || !explanation.trim()) {
    return NextResponse.json({ error: "Empty explanation" }, { status: 400 });
  }

  const language = (student.language as Language) ?? "en";
  const scope = getContentScope({
    studentClass: student.class ?? "Class 6",
    board: student.board ?? "CBSE",
    schoolId: student.schoolId,
  });
  const result = await explainAndGetFeedback(student.id, topicId, explanation.trim(), language, scope);
  return NextResponse.json(result);
}
