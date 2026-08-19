import { NextRequest, NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/session-server";
import { extractSourceText } from "@/lib/agents/extractor";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // stay safely under Vercel's serverless request-body limit
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"]);

export async function POST(req: NextRequest) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large — please use a file under 4MB." }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Please upload a PDF or a photo (JPG/PNG/WEBP)." }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const text = await extractSourceText(base64, file.type);

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
