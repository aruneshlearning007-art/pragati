import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { normalizeEmail, withSessionCookie } from "@/lib/session-server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, cls, board, language, school, state, city, email: rawEmail } = body as {
    name: string;
    cls: string;
    board: string;
    language: string;
    school: string;
    state: string;
    city: string;
    email: string;
  };

  if (!name?.trim() || !cls || !board || !school?.trim() || !state?.trim() || !city?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const email = normalizeEmail(rawEmail);
  if (!email) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: `This email is already registered as a ${existing.role}. Please log in instead.` },
        { status: 409 },
      );
    }

    const schoolRecord =
      (await prisma.school.findFirst({ where: { name: school.trim(), state: state.trim(), city: city.trim() } })) ??
      (await prisma.school.create({ data: { name: school.trim(), state: state.trim(), city: city.trim() } }));

    const user = await prisma.user.create({
      data: {
        role: "student",
        name: name.trim(),
        email,
        class: cls,
        board,
        language: language === "hi" ? "hi" : "en",
        schoolId: schoolRecord.id,
      },
    });

    return withSessionCookie(NextResponse.json({ ok: true }), { userId: user.id, role: "student" });
  } catch (err) {
    // Pilot-only: surface the real error to the (single, non-technical)
    // founder testing this instead of a silent 500. Remove before real launch.
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
