import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@pragati/shared";
import { prisma } from "@pragati/db";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, getSecret());
}

export async function getCurrentStudent() {
  const session = await getSession();
  if (!session || session.role !== "student") return null;
  return prisma.user.findUnique({ where: { id: session.userId }, include: { school: true } });
}

export async function getCurrentTeacher() {
  const session = await getSession();
  if (!session || session.role !== "teacher") return null;
  return prisma.user.findUnique({ where: { id: session.userId }, include: { school: true } });
}
