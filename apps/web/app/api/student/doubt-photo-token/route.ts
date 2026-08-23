import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentStudent } from "@/lib/session-server";

// Authorizes client-side uploads straight to Vercel Blob for photo-based
// doubt solving, mirroring apps/web/app/api/teacher/upload-token/route.ts's
// mechanics (bypassing Vercel's 4.5MB serverless request-body limit) but
// scoped to students and images only — a doubt-photo is a one-off homework
// snapshot, not a permanent chapter source, so it's deleted right after the
// answer is generated (see the doubt route's POST handler).
export async function POST(request: Request): Promise<NextResponse> {
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
      maximumSizeInBytes: 20 * 1024 * 1024,
      addRandomSuffix: true,
    }),
  });

  return NextResponse.json(jsonResponse);
}
