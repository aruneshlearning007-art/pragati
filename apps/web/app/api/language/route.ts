import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { getSession } from "@/lib/session-server";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { language } = (await req.json()) as { language: string };
  if (language !== "en" && language !== "hi") {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.userId }, data: { language } });
  return NextResponse.json({ ok: true });
}
