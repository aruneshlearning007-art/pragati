import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pragati/db";
import { normalizeEmail, withSessionCookie } from "@/lib/session-server";

// Stubbed auth for the pilot (see packages/shared/src/session.ts): no
// password, just an email lookup. Anyone who knows a registered email can
// log in as that person — an explicit, known tradeoff the founder chose
// for speed over security at this stage; flagged in CLAUDE.md as a
// stand-in to replace with real auth before real launch.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email: rawEmail, role } = body as { email: string; role: "student" | "teacher" };

  const email = normalizeEmail(rawEmail);
  if (!email || (role !== "student" && role !== "teacher")) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "No account found with this email. Please sign up first." }, { status: 404 });
  }
  if (user.role !== role) {
    return NextResponse.json(
      { error: `This email is registered as a ${user.role}, not a ${role}. Please use the ${user.role} login.` },
      { status: 400 },
    );
  }

  return withSessionCookie(NextResponse.json({ ok: true }), { userId: user.id, role: user.role });
}
