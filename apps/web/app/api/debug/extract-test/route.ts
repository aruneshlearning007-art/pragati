import { NextRequest, NextResponse } from "next/server";
import { extractSourceText } from "@/lib/agents/extractor";

export const maxDuration = 180;

// Temporary debug-only route to reproduce and verify the fix for a
// founder-reported large-PDF-upload truncation bug directly against the
// real Gemini API, without needing the browser tool to drive a native OS
// file picker (which it can't). Deleted right after use.
export async function POST(req: NextRequest) {
  const { base64, mimeType } = (await req.json()) as { base64: string; mimeType: string };
  try {
    const text = await extractSourceText(base64, mimeType);
    return NextResponse.json({ length: text.length, preview: text.slice(0, 800), tail: text.slice(-300) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
