import { NextRequest, NextResponse } from "next/server";

// Temporary one-off diagnostic to check which Gemini models are valid for
// this API key, and their reported input/output limits. Not a lasting
// endpoint like /api/debug/health — delete once the model-quota
// investigation is done.
export async function GET(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no key" }, { status: 500 });

  const testModel = req.nextUrl.searchParams.get("test");
  if (testModel) {
    const start = Date.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Say OK" }] }] }),
      },
    );
    const elapsed = Date.now() - start;
    const text = await res.text();
    return NextResponse.json({ model: testModel, status: res.status, elapsedMs: elapsed, body: text.slice(0, 500) });
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  return NextResponse.json(data);
}
