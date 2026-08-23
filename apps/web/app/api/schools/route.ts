import { NextResponse } from "next/server";
import { prisma } from "@pragati/db";

// Lists every school so onboarding can offer "pick your existing school"
// instead of asking every signup to retype name/state/city as free text —
// the retyping is what let two people at the same real school land on two
// different School rows (e.g. "UP" vs "Uttar Pradesh"), since the old
// find-or-create matched on exact text. No auth needed; this is signup-time
// data, not otherwise sensitive.
export async function GET() {
  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, state: true, city: true },
  });
  return NextResponse.json({ schools });
}
