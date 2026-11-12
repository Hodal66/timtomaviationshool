import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { emailConfigured, waLink } from "@/lib/notify";
import { label } from "@/lib/format";
export const dynamic = "force-dynamic";

async function mark(status: "SENT" | "SKIPPED", fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !can.admissions(s.role)) throw new Error("Not allowed");
  await db.notification.updateMany({ where: { id: String(fd.get("id")), channel: "WHATSAPP", status: "QUEUED" }, data: { status, sentAt: status === "SENT" ? new Date() : null } });
  revalidatePath("/messages"); revalidatePath("/dashboard");
}

/** WhatsApp messages waiting for staff, and the email log. Staff send WhatsApp from the school's own number in one click. */
export default async function Messages() {
  const me = await getSession(); if (!me || !can.admissions(me.role)) redirect("/dashboard");
  const [queue, log] = await Promise.all([
    db.notification.findMany({ where: { channel: "WHATSAPP", status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: 100, include: { applicant: { select: { id: true, fullName: true, reference: true } } } }),
    db.notification.findMany({ where: { channel: "EMAIL" }, orderBy: { createdAt: "desc" }, take: 30, include: { applicant: { select: { id: true, fullName: true } } } }),
  ]);
  return (<><div className="top"><h1>Messages</h1><p>Every status change creates a message for the applicant. Email is sent automatically; WhatsApp waits here for you to send it.</p></div>
    {!emailConfigured() && <p className="panel" style={{ borderLeft: "4px solid var(--orange)", marginBottom: 16 }}><b>Email is not sending yet.</b> Add the Gmail app password as <code>SMTP_PASS</code> in Vercel (Project, Settings, Environment Variables) and redeploy. Messages are still recorded below.</p>}
    <div className="panel tbl" style={{ marginBottom: 16 }}><h2>WhatsApp to send ({queue.length})</h2><table><thead><tr><th>Created</th><th>Applicant</th><th>Message</th><th></th></tr></thead><tbody>
      {queue.length === 0 && <tr><td colSpan={4}>Nothing waiting.</td></tr>}
      {queue.map((n) => <tr key={n.id}><td>{n.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td><a href={`/admissions/${n.applicant.id}`}>{n.applicant.fullName}</a><small style={{ display: "block", color: "var(--muted)" }}>{n.to}</small></td>
        <td style={{ whiteSpace: "normal", maxWidth: 440 }}>{n.body.split("\n").find((l) => l.trim() && !l.startsWith("Hello")) ?? n.template}</td>
        <td><form style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="hidden" name="id" value={n.id} />
          {waLink(n.to, n.body) ? <a href={waLink(n.to, n.body)!} target="_blank" rel="noreferrer">Open WhatsApp</a> : <span>No valid number</span>}
          <button className="s" formAction={mark.bind(null, "SENT")}>Mark sent</button><button className="s" formAction={mark.bind(null, "SKIPPED")}>Skip</button></form></td></tr>)}
    </tbody></table></div>
    <div className="panel tbl"><h2>Recent email</h2><table><thead><tr><th>Created</th><th>To</th><th>Subject</th><th>Status</th></tr></thead><tbody>
      {log.length === 0 && <tr><td colSpan={4}>No email yet.</td></tr>}
      {log.map((n) => <tr key={n.id}><td>{n.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td>{n.to}</td><td style={{ whiteSpace: "normal" }}><a href={`/admissions/${n.applicant.id}`}>{n.subject}</a></td>
        <td><span className={`pill ${n.status === "SENT" ? "ok" : n.status === "FAILED" ? "bad" : "warn"}`}>{label(n.status)}</span>{n.error && <small style={{ display: "block", color: "var(--muted)", whiteSpace: "normal", maxWidth: 260 }}>{n.error}</small>}</td></tr>)}
    </tbody></table></div></>);
}
