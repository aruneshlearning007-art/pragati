import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

// TEMPORARY test-only endpoint to verify the photo-based doubt solving
// feature actually deletes uploaded photos after use (privacy — no lasting
// reason to retain a photo of a child's homework once answered). Remove
// after verification.
export async function GET() {
  const { blobs } = await list();
  return NextResponse.json({ count: blobs.length, blobs: blobs.map((b) => ({ pathname: b.pathname, uploadedAt: b.uploadedAt })) });
}
