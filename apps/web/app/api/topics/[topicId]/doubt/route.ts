import { NextRequest, NextResponse } from "next/server";
import { get, del } from "@vercel/blob";
import { getCurrentStudent } from "@/lib/session-server";
import { getDoubtHistory, answerDoubt, isDoubtChatDisabled } from "@/lib/agents/doubt";
import type { Language } from "@/lib/i18n";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

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
  const { message, mode, blobUrl } = (await req.json()) as { message?: string; mode?: string; blobUrl?: string };
  const text = (message ?? "").trim();
  if (!text && !blobUrl) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const language = (student.language as Language) ?? "en";

  // A doubt-photo is a one-off homework snapshot, not permanent content
  // like a teacher's uploaded chapter — fetch it, use it, then delete it
  // regardless of outcome, so it's never retained.
  let image: { base64: string; mimeType: string } | undefined;
  try {
    if (blobUrl) {
      const result = await get(blobUrl, { access: "private" });
      if (result && result.statusCode === 200 && ALLOWED_IMAGE_MIME.has(result.blob.contentType)) {
        const bytes = await new Response(result.stream).arrayBuffer();
        image = { base64: Buffer.from(bytes).toString("base64"), mimeType: result.blob.contentType };
      }
    }

    const result = await answerDoubt(student.id, topicId, text, language, mode === "guide" ? "guide" : "direct", image);
    return NextResponse.json(result);
  } finally {
    if (blobUrl) {
      await del(blobUrl).catch(() => {});
    }
  }
}
