import { NextResponse } from "next/server";
import { prisma } from "@pragati/db";

// TEMPORARY: verify no two School rows share the exact same
// name+state+city before adding a unique constraint on that trio
// (a migration adding the constraint would otherwise fail outright).
export async function GET() {
  const schools = await prisma.school.findMany();
  const seen = new Map<string, typeof schools>();
  for (const s of schools) {
    const key = `${s.name}|||${s.state}|||${s.city}`;
    const list = seen.get(key) ?? [];
    list.push(s);
    seen.set(key, list);
  }
  const dupes = [...seen.entries()].filter(([, list]) => list.length > 1);
  return NextResponse.json({
    totalSchools: schools.length,
    exactDuplicateGroups: dupes.map(([key, list]) => ({ key, ids: list.map((s) => s.id) })),
  });
}
