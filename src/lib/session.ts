import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

const COOKIE = "tas_session";
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

export type Session = { uid: string; name: string; role: Role };

export async function createSession(s: Session) {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is not set");
  const token = await new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h").sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 8 * 3600 });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }
export async function getSession(): Promise<Session | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t || !process.env.AUTH_SECRET) return null;
  try { const { payload } = await jwtVerify(t, key()); return payload as unknown as Session; } catch { return null; }
}
