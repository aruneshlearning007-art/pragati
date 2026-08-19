import { NextRequest, NextResponse } from "next/server";
import { generate } from "@pragati/shared";

// Temporary one-off diagnostic for comparing LLM output quality across
// providers. Not a lasting endpoint — delete once the comparison is done.
export async function POST(req: NextRequest) {
  const { system, user, json } = (await req.json()) as { system: string; user: string; json?: boolean };
  const reply = await generate({ system, messages: [{ role: "user", content: user }], json });
  return NextResponse.json({ reply });
}
