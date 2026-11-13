import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { getT } from "@/lib/i18n/server";
import { replyTicket } from "@/lib/student";
export const dynamic = "force-dynamic";
const helper = (r: string) => can.reports(r as never); // every office role can answer students

async function reply(fd: FormData) {
  "use server";
  const s = await getSession(); if (!s || !helper(s.role)) throw new Error("Not allowed");
  const err = await replyTicket(String(fd.get("id")), String(fd.get("body") ?? ""), { staff: s.name }); revalidatePath("/support"); redirect("/support" + (err ? "?e=" + encodeURIComponent(err) : "?ok=1"));
}
async function announce(fd: FormData) {
  "use server";
  const s = await getSession(); if (!s || !helper(s.role)) throw new Error("Not allowed");
  const title = String(fd.get("title") ?? "").trim().slice(0, 140), body = String(fd.get("body") ?? "").trim().slice(0, 2000), groupId = String(fd.get("groupId") ?? "") || null;
  if (title.length < 3 || body.length < 3) redirect("/support?e=" + encodeURIComponent("Write a title and a message."));
  await db.announcement.create({ data: { title, body, groupId, createdBy: s.name } }); revalidatePath("/support"); redirect("/support?ok=1");
}
async function removeAnnouncement(fd: FormData) { "use server"; const s = await getSession(); if (!s || !helper(s.role)) throw new Error("Not allowed"); await db.announcement.delete({ where: { id: String(fd.get("id")) } }); revalidatePath("/support"); }

/** STU-11 support tickets and COM-03 announcements. */
export default async function Support({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string; all?: string }> }) {
  const me = await getSession(); if (!me || !helper(me.role)) redirect("/dashboard");
  const { t } = await getT(); const sp = await searchParams;
  const [tickets, groups, notes, rated] = await Promise.all([db.ticket.findMany({ where: sp.all ? {} : { status: "OPEN" }, include: { applicant: true, messages: { orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "asc" }, take: 100 }), db.classGroup.findMany({ orderBy: { name: "asc" } }), db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 20 }), db.ticket.aggregate({ where: { rating: { not: null } }, _avg: { rating: true }, _count: true })]);
  return (<><div className="top"><div><h1>{t("Student support")}</h1><p>{t("Answer questions from students and applicants, and post announcements.")}</p></div><a href={sp.all ? "/support" : "/support?all=1"}>{sp.all ? t("Show waiting only") : t("Show all")}</a></div>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="ok" role="status">{t("Saved.")}</p>}
    <div className="kpis"><div className="kpi"><span>{t("Waiting for an answer")}</span><b>{tickets.filter((x) => x.status === "OPEN").length}</b></div><div className="kpi"><span>{t("Average rating")}</span><b>{rated._avg.rating ? rated._avg.rating.toFixed(1) + " / 5" : "-"}</b><small style={{ color: "var(--muted)" }}>{rated._count} {t("rated")}</small></div></div>
    {tickets.length === 0 && <div className="panel empty" style={{ marginBottom: 16 }}>{t("No questions are waiting.")}</div>}
    <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>{tickets.map((k) => <div className="panel" key={k.id} data-ticket={k.id}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><b>{k.subject}</b> <span className="pill">{k.category}</span> · <a href={`/admissions/${k.applicantId}`}>{k.applicant.fullName}</a></div><span className={`pill ${k.status === "OPEN" ? "warn" : "ok"}`}>{k.status === "OPEN" ? t("Waiting") : k.status === "ANSWERED" ? t("Answered") : `${t("Closed")}${k.rating ? ` · ${k.rating}/5` : ""}`}</span></div>
      <ul className="tl" style={{ margin: "10px 0" }}>{k.messages.map((m) => <li key={m.id}><small>{m.author} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}</small><div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div></li>)}</ul>
      {k.status !== "CLOSED" && <form action={reply} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input type="hidden" name="id" value={k.id} /><textarea name="body" rows={2} required placeholder={t("Your answer")} aria-label={t("Your answer")} style={{ flex: 1, minWidth: 240 }} /><button className="p" type="submit">{t("Send answer")}</button></form>}</div>)}</div>
    <form action={announce} className="panel" style={{ display: "grid", gap: 8, marginBottom: 16 }}><h2 style={{ marginBottom: 0 }}>{t("Post an announcement")}</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input name="title" placeholder={t("Title")} aria-label={t("Title")} required style={{ flex: 1, minWidth: 220 }} /><select name="groupId" aria-label={t("Audience")}><option value="">{t("All students")}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
      <textarea name="body" rows={3} placeholder={t("Message")} aria-label={t("Message")} required /><button type="submit" style={{ justifySelf: "start" }}>{t("Post announcement")}</button></form>
    <div className="panel"><h2>{t("Recent announcements")}</h2>{notes.length === 0 ? <p className="empty">{t("Nothing yet.")}</p> : <ul className="tl">{notes.map((n) => <li key={n.id}><b>{n.title}</b> <small>{n.createdBy} · {n.createdAt.toISOString().slice(0, 10)} · {n.groupId ? groups.find((g) => g.id === n.groupId)?.name : t("All students")}</small><div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div><form action={removeAnnouncement}><input type="hidden" name="id" value={n.id} /><button className="s danger" type="submit">{t("Delete")}</button></form></li>)}</ul>}</div></>);
}
