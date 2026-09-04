import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { extractSourceText } from "@/lib/agents/extractor";

export const maxDuration = 180;

// Temporary debug-only route to reproduce and verify the fix for a
// founder-reported large-PDF-upload truncation bug directly against the
// real Gemini API, without needing the browser tool to drive a native OS
// file picker (which it can't). Takes a Blob URL (the file was uploaded
// server-side via a script, same as the real client-upload flow avoids
// Vercel's 4.5MB request-body limit) rather than raw base64. Deleted right
// after use.
export async function POST(req: NextRequest) {
  const { blobUrl, mimeType } = (await req.json()) as { blobUrl: string; mimeType: string };
  try {
    const result = await get(blobUrl, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "Could not retrieve the uploaded file." }, { status: 404 });
    }
    const bytes = await new Response(result.stream).arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const text = await extractSourceText(base64, mimeType);
    return NextResponse.json({ length: text.length, preview: text.slice(0, 800), tail: text.slice(-300) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
