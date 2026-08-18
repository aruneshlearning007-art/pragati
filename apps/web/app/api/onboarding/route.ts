import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { createSessionToken, SESSION_COOKIE } from "@pragati/shared";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, cls, board, language, school, state, city } = body as {
    name: string;
    cls: string;
    board: string;
    language: string;
    school: string;
    state: string;
    city: string;
  };

  if (!name?.trim() || !cls || !board || !school?.trim() || !state?.trim() || !city?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let token: string;
  try {
    const schoolRecord =
      (await prisma.school.findFirst({ where: { name: school.trim(), state: state.trim(), city: city.trim() } })) ??
      (await prisma.school.create({ data: { name: school.trim(), state: state.trim(), city: city.trim() } }));

    const user = await prisma.user.create({
      data: {
        role: "student",
        name: name.trim(),
        email: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pending.pragati.local`,
        class: cls,
        board,
        language: language === "hi" ? "hi" : "en",
        schoolId: schoolRecord.id,
      },
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server misconfigured: JWT_SECRET is not set" }, { status: 500 });
    }
    token = createSessionToken({ userId: user.id, role: "student" }, secret);
  } catch (err) {
    // Pilot-only: surface the real error to the (single, non-technical)
    // founder testing this instead of a silent 500. Remove before real launch.
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
