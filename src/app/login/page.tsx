import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

async function login(fd: FormData) {
  "use server";
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  const ok = user && (await bcrypt.compare(String(fd.get("password") ?? ""), user.passwordHash));
  if (!ok) redirect("/login?e=1");
  await createSession({ uid: user.id, name: user.name, role: user.role });
  redirect("/dashboard");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (<div className="center"><form action={login} className="box">
    <h1>TAS-One</h1><p style={{ margin: 0, color: "var(--muted)" }}>Timtom Aviation School staff sign-in</p>
    <label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="username" />
    <label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" />
    {e && <span className="err">Email or password is incorrect.</span>}
    <button className="p" type="submit">Sign in</button>
    <a href="/verify">Verify a certificate</a>
  </form></div>);
}
