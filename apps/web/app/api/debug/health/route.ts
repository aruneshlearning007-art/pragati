import { NextResponse } from "next/server";
import { prisma } from "@pragati/db";

// Pilot-only diagnostic endpoint: reports env var presence (never values)
// and a live DB ping, so infra issues can be checked with one URL visit
// instead of digging through Vercel logs. Remove before real launch.
export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DIRECT_URL: Boolean(process.env.DIRECT_URL),
    JWT_SECRET: Boolean(process.env.JWT_SECRET),
    GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
  };

  let db: { ok: true } | { ok: false; error: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true };
  } catch (err) {
    db = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({ env, db });
}
