import { NextResponse } from "next/server";
import { prisma } from "@pragati/db";

// TEMPORARY test-only endpoint to look up which school (and which
// teacher(s) at that school) a given user email belongs to. Remove after use.
export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email query param required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, include: { school: true } });
  if (!user) return NextResponse.json({ error: "No user with that email" }, { status: 404 });

  const teachersAtSameSchool = user.schoolId
    ? await prisma.user.findMany({ where: { role: "teacher", schoolId: user.schoolId } })
    : [];

  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      class: user.class,
      board: user.board,
      schoolId: user.schoolId,
      school: user.school ? { name: user.school.name, state: user.school.state, city: user.school.city } : null,
      createdAt: user.createdAt,
    },
    teachersAtSameSchool: teachersAtSameSchool.map((t) => ({ id: t.id, name: t.name, email: t.email, createdAt: t.createdAt })),
  });
}
