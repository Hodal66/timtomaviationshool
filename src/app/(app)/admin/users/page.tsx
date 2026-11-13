import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { label } from "@/lib/format";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "ADMISSIONS", "FINANCE", "ACADEMIC", "MARKETING", "BRANCH_MANAGER", "LECTURER"] as const;
async function admin() { const s = await getSession(); if (!s || s.role !== "ADMIN") throw new Error("Not allowed"); return s; }
async function create(fd: FormData) {
  "use server"; await admin();
  const email = String(fd.get("email") ?? "").trim().toLowerCase(), name = String(fd.get("name") ?? "").trim().slice(0, 80), role = String(fd.get("role")), pw = String(fd.get("password") ?? "");
  const back = (m: string) => redirect("/admin/users?e=" + encodeURIComponent(m));
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) back("Enter a name and a valid email."); if (pw.length < 10) back("The password needs at least 10 characters."); if (!ROLES.includes(role as never)) back("Choose a role.");
  if (await db.user.findUnique({ where: { email } })) back("That email already has an account.");
  await db.user.create({ data: { name, email, role: role as never, passwordHash: await bcrypt.hash(pw, 10) } }); revalidatePath("/admin/users"); redirect("/admin/users?ok=1");
}
async function setRole(role: string, fd: FormData) { "use server"; const s = await admin(); const id = String(fd.get("id")); if (id === s.uid || !ROLES.includes(role as never)) return; await db.user.update({ where: { id }, data: { role: role as never } }); revalidatePath("/admin/users"); }
async function resetPw(fd: FormData) { "use server"; await admin(); const pw = String(fd.get("password") ?? ""); if (pw.length < 10) redirect("/admin/users?e=" + encodeURIComponent("The password needs at least 10 characters.")); await db.user.update({ where: { id: String(fd.get("id")) }, data: { passwordHash: await bcrypt.hash(pw, 10) } }); redirect("/admin/users?ok=1"); }
async function remove(ids: string[]) { "use server"; const s = await admin(); const del = ids.filter((i) => i !== s.uid); await db.user.deleteMany({ where: { id: { in: del } } }); revalidatePath("/admin/users"); return `${del.length} deleted` + (del.length < ids.length ? ". You cannot delete your own account." : "."); }

export default async function Users({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const me = await getSession(); if (!me || me.role !== "ADMIN") redirect("/dashboard");
  const { t } = await getT(); const sp = await searchParams; const users = await db.user.findMany({ orderBy: { name: "asc" } });
  const cols: Col[] = [{ key: "name", label: t("Name") }, { key: "email", label: "Email" }, { key: "role", label: t("Role"), filter: true }, { key: "act", label: "", sortable: false }];
  const rows: Row[] = users.map((u) => ({ id: u.id, v: { name: u.name, email: u.email, role: label(u.role) }, c: { role: <span className="pill">{label(u.role)}{u.id === me.uid ? ` (${t("you")})` : ""}</span>,
    act: u.id === me.uid ? null : <details><summary style={{ cursor: "pointer" }}>{t("Manage")}</summary><div style={{ display: "grid", gap: 6, padding: "8px 0", minWidth: 240, whiteSpace: "normal" }}><form style={{ display: "flex", gap: 4, flexWrap: "wrap" }}><input type="hidden" name="id" value={u.id} />{ROLES.filter((r) => r !== u.role).map((r) => <button key={r} className="s" formAction={setRole.bind(null, r)}>{label(r)}</button>)}</form><form action={resetPw} style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={u.id} /><input name="password" type="password" minLength={10} placeholder={t("New password")} aria-label={t("New password")} required /><button className="s" type="submit">{t("Reset password")}</button></form></div></details> } }));
  return (<><div className="top"><div><h1>{t("Staff accounts")}</h1><p>{t("Add staff, change roles, reset passwords or delete accounts. Only administrators see this page.")}</p></div></div>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="ok" role="status">{t("Saved.")}</p>}
    <form action={create} className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}><b style={{ width: "100%" }}>{t("Add a staff member")}</b>
      <input name="name" placeholder={t("Full name")} aria-label={t("Full name")} required /><input name="email" type="email" placeholder="email@example.com" aria-label="Email" required />
      <select name="role" aria-label={t("Role")}>{ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}</select><input name="password" type="password" minLength={10} placeholder={t("Password (10+ characters)")} aria-label={t("Password")} required /><button className="p" type="submit">{t("Add")}</button></form>
    <div className="panel"><DataTable id="users" cols={cols} rows={rows} exportName="staff" bulk={[{ label: t("Delete"), danger: true, confirm: t("Delete the selected accounts?"), run: remove }]} /></div></>);
}
