import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// DATABASE_URL points at Supabase's transaction pooler (PgBouncer), which
// doesn't support prepared statements — without this flag, concurrent
// serverless invocations collide with "prepared statement already exists"
// (Postgres 42P05). See https://pris.ly/d/pgbouncer
function pgbouncerUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.includes("pgbouncer=true")
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: pgbouncerUrl(process.env.DATABASE_URL) } },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
