import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/session-server";

// Authorizes client-side uploads straight to Vercel Blob, bypassing
// Vercel's hard 4.5MB request-body limit on this serverless function
// itself (a real chapter PDF can easily be 8-10MB — that limit isn't
// configurable, so the file simply can't pass through a normal route
// handler body at all). The file never touches this route; only this
// small token handshake does.
export async function POST(request: Request): Promise<NextResponse> {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "text/plain",
      ],
      // Matches Gemini's inline-data request size ceiling — a bigger file
      // wouldn't be usable downstream even if Blob accepted it.
      maximumSizeInBytes: 20 * 1024 * 1024,
      addRandomSuffix: true,
    }),
  });

  return NextResponse.json(jsonResponse);
}
