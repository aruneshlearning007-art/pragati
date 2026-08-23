import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { normalizeEmail, withSessionCookie } from "@/lib/session-server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, language, school, state, city, schoolId, email: rawEmail } = body as {
    name: string;
    language: string;
    school: string;
    state: string;
    city: string;
    schoolId?: string | null;
    email: string;
  };

  const isNewSchool = !schoolId;
  if (!name?.trim() || (isNewSchool && (!school?.trim() || !state?.trim() || !city?.trim()))) {
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

    let schoolRecord;
    if (schoolId) {
      try {
        schoolRecord = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
      } catch {
        return NextResponse.json({ error: "Selected school not found. Please pick again." }, { status: 400 });
      }
    } else {
      schoolRecord = await prisma.school.upsert({
        where: { name_state_city: { name: school.trim(), state: state.trim(), city: city.trim() } },
        update: {},
        create: { name: school.trim(), state: state.trim(), city: city.trim() },
      });
    }

    const user = await prisma.user.create({
      data: {
        role: "teacher",
        name: name.trim(),
        email,
        language: language === "hi" ? "hi" : "en",
        schoolId: schoolRecord.id,
      },
    });

    return withSessionCookie(NextResponse.json({ ok: true }), { userId: user.id, role: "teacher" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
