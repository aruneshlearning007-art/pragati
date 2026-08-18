import { createHmac, timingSafeEqual } from "node:crypto";

// Stubbed auth for the pilot: no password/OAuth, just a signed cookie
// identifying who onboarded on this browser. Flagged as a stand-in to
// replace with a real auth provider before real launch.
export interface SessionPayload {
  userId: string;
  role: "student" | "parent" | "teacher";
}

export const SESSION_COOKIE = "pragati_session";

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function createSessionToken(payload: SessionPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(data, secret);
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null, secret: string): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = sign(data, secret);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as SessionPayload;
  } catch {
    return null;
  }
}
