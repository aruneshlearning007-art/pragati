import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getCurrentTeacher } from "@/lib/session-server";
import { extractSourceText } from "@/lib/agents/extractor";

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"]);

// Takes a Blob URL (the file already lives in Vercel Blob — the client
// uploaded it directly, bypassing this route entirely, since Vercel's
// 4.5MB serverless request-body limit can't otherwise fit a real chapter
// PDF) rather than the raw file, fetches it server-side, and hands it to
// Gemini for transcription.
export async function POST(req: NextRequest) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { blobUrl } = (await req.json()) as { blobUrl: string };
  if (!blobUrl) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const result = await get(blobUrl, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "Could not retrieve the uploaded file." }, { status: 404 });
    }

    if (!ALLOWED_MIME.has(result.blob.contentType)) {
      return NextResponse.json({ error: "Please upload a PDF or a photo (JPG/PNG/WEBP)." }, { status: 400 });
    }

    const bytes = await new Response(result.stream).arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const text = await extractSourceText(base64, result.blob.contentType);

    if (text === "EXTRACTION_FAILED" || !text) {
      return NextResponse.json(
        { error: "Could not read any text from this file. Please try a clearer photo or paste the text instead." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
