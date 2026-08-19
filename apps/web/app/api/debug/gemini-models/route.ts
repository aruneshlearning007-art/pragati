import { NextResponse } from "next/server";

// Temporary one-off diagnostic to check which Gemini models are valid for
// this API key, and their reported input/output limits. Not a lasting
// endpoint like /api/debug/health — delete once the model-quota
// investigation is done.
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no key" }, { status: 500 });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  return NextResponse.json(data);
}
