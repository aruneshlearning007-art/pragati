import { NextResponse } from "next/server";
import { prisma } from "@pragati/db";

// TEMPORARY test-only endpoint to diagnose a real founder-reported bug:
// a teacher's Class 7 chapter upload seemingly wasn't created, and the
// linked student can't see it after publish. Dumps recent chapters/users/
// schools so the mismatch can be found without needing the founder to
// dig through the app. Remove after diagnosis.
export async function GET() {
  const [chapters, users, schools] = await Promise.all([
    prisma.chapter.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { subject: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { school: true },
    }),
    prisma.school.findMany({ orderBy: { id: "desc" }, take: 15 }),
  ]);

  return NextResponse.json({
    chapters: chapters.map((c) => ({
      id: c.id,
      title: c.titleEn,
      subject: c.subject.nameEn,
      class: c.class,
      board: c.board,
      schoolId: c.schoolId,
      teacherId: c.teacherId,
      status: c.status,
      createdAt: c.createdAt,
    })),
    users: users.map((u) => ({
      id: u.id,
      role: u.role,
      name: u.name,
      email: u.email,
      class: u.class,
      board: u.board,
      schoolId: u.schoolId,
      schoolName: u.school?.name,
      createdAt: u.createdAt,
    })),
    schools: schools.map((s) => ({ id: s.id, name: s.name, state: s.state, city: s.city })),
  });
}
