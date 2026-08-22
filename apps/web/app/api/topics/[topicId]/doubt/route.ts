import { NextRequest, NextResponse } from "next/server";
import { getCurrentStudent } from "@/lib/session-server";
import { getDoubtHistory, answerDoubt, isDoubtChatDisabled } from "@/lib/agents/doubt";
import type { Language } from "@/lib/i18n";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { topicId } = await params;
  const [messages, disabled] = await Promise.all([
    getDoubtHistory(student.id, topicId),
    isDoubtChatDisabled(student.id),
  ]);
  return NextResponse.json({ messages, disabled });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { topicId } = await params;
  const { message, mode } = (await req.json()) as { message: string; mode?: string };
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const language = (student.language as Language) ?? "en";
  const result = await answerDoubt(student.id, topicId, message.trim(), language, mode === "guide" ? "guide" : "direct");
  return NextResponse.json(result);
}
