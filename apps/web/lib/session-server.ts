import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, createSessionToken, verifySessionToken, type SessionPayload } from "@pragati/shared";
import { prisma } from "@pragati/db";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalizes (trim + lowercase) and validates an email the user typed. Returns null if invalid. */
export function normalizeEmail(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim().toLowerCase() ?? "";
  return EMAIL_REGEX.test(trimmed) ? trimmed : null;
}

export function getSecret(): string {
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

/**
 * Issues a session cookie for the given user on the response — the same
 * mechanism whether the user just signed up or is logging back in, so a
 * returning user's session is indistinguishable from a fresh signup's.
 */
export function withSessionCookie(res: NextResponse, payload: SessionPayload): NextResponse {
  const token = createSessionToken(payload, getSecret());
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
