import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { limited, exhausted, clientIp } from "@/lib/ratelimit";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

async function login(fd: FormData) {
  "use server";
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  // Only failed sign-ins count: 10 per 15 minutes per account and 30 per address, then a 15 minute lock.
  const ip = "login-ip:" + clientIp(await headers()), who = "login-user:" + email;
  if (exhausted(ip, 30) || exhausted(who, 10)) redirect("/login?e=2");
  const user = await db.user.findUnique({ where: { email } });
  const ok = user && (await bcrypt.compare(String(fd.get("password") ?? ""), user.passwordHash)) && user.active; // archived accounts cannot sign in (LEC-04)
  if (!ok) { limited(ip, 30, 15 * 60e3); limited(who, 10, 15 * 60e3); redirect("/login?e=1"); }
  await createSession({ uid: user.id, name: user.name, role: user.role });
  redirect("/dashboard");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (<div className="center"><form action={login} className="box">
    <h1>TAS-One</h1><p style={{ margin: 0, color: "var(--muted)" }}>Timtom Aviation School staff sign-in</p>
    <label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="username" />
    <label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" />
    {e && <span className="err" role="alert">{e === "2" ? "Too many attempts. Wait 15 minutes and try again." : "Email or password is incorrect."}</span>}
    <button className="p" type="submit">Sign in</button>
    <a href="/verify">Verify a certificate</a>
  </form></div>);
}
