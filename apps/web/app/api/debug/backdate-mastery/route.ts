import { NextResponse } from "next/server";
import { prisma } from "@pragati/db";

// TEMPORARY test-only endpoint for live-verifying spaced-repetition revision
// reminders (which depend on elapsed time). Backdates MasteryScore.lastUpdated
// rows for one student, optionally filtered to one subConceptId. Remove after
// verification — never meant to ship.
export async function POST(req: Request) {
  const body = await req.json();
  const { email, days, subConceptId } = body as { email: string; days: number; subConceptId?: string };

  const student = await prisma.user.findUnique({ where: { email } });
  if (!student) return NextResponse.json({ error: "no such user" }, { status: 404 });

  const backdated = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.masteryScore.updateMany({
    where: { studentId: student.id, ...(subConceptId ? { subConceptId } : {}) },
    data: { lastUpdated: backdated },
  });

  const rows = await prisma.masteryScore.findMany({ where: { studentId: student.id } });
  return NextResponse.json({ updated: result.count, rows });
}
