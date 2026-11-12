import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { label, money } from "@/lib/format";
export const dynamic = "force-dynamic";

async function guard() { const s = await getSession(); if (!s || !can.admissions(s.role)) throw new Error("Not allowed"); return s; }
const back = (id: string) => { revalidatePath(`/admissions/${id}`); revalidatePath("/admissions"); redirect(`/admissions/${id}`); };

async function setDoc(fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id")), docId = String(fd.get("docId")), status = String(fd.get("status"));
  if (!["RECEIVED", "VERIFIED", "MISSING", "PENDING"].includes(status)) return;
  const d = await db.documentItem.update({ where: { id: docId }, data: { status: status as never, note: String(fd.get("note") ?? "").trim() || null } });
  await db.applicationEvent.create({ data: { applicantId: id, type: "DOC", actorName: s.name, message: `${d.kind}: ${label(status)}${status === "MISSING" ? " (applicant must provide it)" : ""}` } });
  back(id);
}
async function addNote(fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id")), m = String(fd.get("note") ?? "").trim().slice(0, 1000);
  if (m) await db.applicationEvent.create({ data: { applicantId: id, type: "NOTE", actorName: s.name, message: m } });
  back(id);
}
async function assign(fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id")), uid = String(fd.get("uid")) || null;
  await db.applicant.update({ where: { id }, data: { assignedToId: uid } });
  await db.applicationEvent.create({ data: { applicantId: id, type: "SYSTEM", actorName: s.name, message: uid ? "Assigned to an officer." : "Unassigned." } });
  back(id);
}
async function decide(fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id")), op = String(fd.get("op"));
  const a = await db.applicant.findUnique({ where: { id } });
  if (!a) return;
  if (op === "reject") await db.applicant.update({ where: { id }, data: { status: "REJECTED", events: { create: { type: "STATUS", actorName: s.name, message: `Not admitted. ${String(fd.get("reason") ?? "").slice(0, 300)}` } } } });
  if (op === "reopen" && a.status === "REJECTED") await db.applicant.update({ where: { id }, data: { status: "SUBMITTED", events: { create: { type: "STATUS", actorName: s.name, message: "Reopened." } } } });
  back(id);
}

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await db.applicant.findUnique({ where: { id }, include: { programme: true, intake: true, branch: true, documents: true, invoices: true, events: { orderBy: { createdAt: "desc" } }, assignedTo: true, uploads: { select: { id: true, kind: true, filename: true, size: true, mime: true } } } });
  if (!a) notFound();
  const officers = await db.user.findMany({ where: { role: { in: ["ADMISSIONS", "ADMIN"] } }, orderBy: { name: "asc" } });
  return (<><div className="top"><h1>{a.fullName}</h1><p>{a.reference} · {a.programme.name} · {a.intake.label} · {a.branch.name} · {a.session === "WEEKDAY" ? "Weekday" : "Weekend"} · <span className="pill">{label(a.status)}</span></p></div>
    <div className="panel" style={{ marginBottom: 16 }}><h2>Contact and source</h2>
      <p style={{ margin: 0 }}>Phone: {a.phone ?? "-"} · Email: {a.email ?? "-"} · Born: {a.dateOfBirth?.toISOString().slice(0, 10) ?? "-"}</p>
      {a.educationLevel && <p style={{ margin: "4px 0 0" }}>Education: {a.educationLevel}, {a.institution} ({a.completionYear})</p>}
      {a.guardianName && <p style={{ margin: "4px 0 0" }}>Guardian: {a.guardianName} ({a.guardianPhone})</p>}
      <p style={{ margin: "4px 0 0" }}>Source: {a.leadSource ?? a.source}{a.utmCampaign ? ` · campaign ${a.utmCampaign}` : ""}{a.language ? ` · language ${a.language}` : ""}</p>
      <form action={assign} style={{ marginTop: 10, display: "flex", gap: 8 }}><input type="hidden" name="id" value={a.id} />
        <select name="uid" defaultValue={a.assignedToId ?? ""} aria-label="Assigned officer"><option value="">Unassigned</option>{officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select><button type="submit">Assign</button></form></div>
    <div className="panel tbl" style={{ marginBottom: 16 }}><h2>Documents</h2><table><thead><tr><th>Document</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {a.documents.map((d) => <tr key={d.id}><td>{d.kind}{d.note && <small style={{ display: "block", color: "var(--muted)" }}>{d.note}</small>}{a.uploads.filter((u) => u.kind === d.kind).map((u) => <small key={u.id} style={{ display: "block" }}><a href={`/api/documents/${u.id}`} target="_blank" rel="noreferrer">View {u.filename}</a> ({Math.max(1, Math.round(u.size / 1024))} KB)</small>)}</td><td><span className={`pill ${d.status === "VERIFIED" ? "ok" : d.status === "MISSING" ? "bad" : "warn"}`}>{label(d.status)}</span></td>
        <td><form action={setDoc} style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="docId" value={d.id} /><input name="note" placeholder="Note" aria-label="Note" style={{ width: 150 }} />
          <button className="s" name="status" value="RECEIVED">Received</button><button className="s" name="status" value="VERIFIED">Verify</button><button className="s" name="status" value="MISSING">Request again</button></form></td></tr>)}
    </tbody></table><p style={{ color: "var(--muted)", marginBottom: 0 }}>Requesting a document again records it on the application. Messages to the applicant are not sent automatically yet.</p></div>
    <div className="panel tbl" style={{ marginBottom: 16 }}><h2>Invoice and payment</h2>
      {a.invoices.length === 0 ? <p>No invoice. This course has no registration fee set.</p> : <table><tbody>{a.invoices.map((i) => <tr key={i.id}><td>{i.reference}</td><td>{i.description}</td><td>{money(i.amountMinor, i.currency)}</td><td><span className={`pill ${i.status === "PAID" ? "ok" : "warn"}`}>{label(i.status)}</span></td></tr>)}</tbody></table>}
      <p style={{ color: "var(--muted)", marginBottom: 0 }}>Only Finance can mark an invoice paid, on the <a href="/payments">Payments</a> page.</p></div>
    <div className="panel" style={{ marginBottom: 16 }}><h2>Decision</h2>
      {a.status === "REJECTED" ? <form action={decide}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="reopen" /><button type="submit">Reopen application</button></form> :
        <form action={decide} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="reject" /><input name="reason" placeholder="Reason" aria-label="Reason" style={{ minWidth: 260 }} /><button type="submit">Not admitted</button></form>}
      <p style={{ color: "var(--muted)", marginBottom: 0 }}>To move forward, use Next stage on the <a href="/admissions">board</a>. Rules: documents verified, then invoice paid, then admitted, then enrolled.</p></div>
    <div className="panel"><h2>Notes and history</h2>
      <form action={addNote} style={{ display: "flex", gap: 8, marginBottom: 12 }}><input type="hidden" name="id" value={a.id} /><input name="note" placeholder="Internal note" aria-label="Internal note" style={{ flex: 1 }} /><button className="p" type="submit">Add note</button></form>
      <ul className="ol">{a.events.map((e) => <li key={e.id}>{e.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {e.actorName} · <span className="pill">{e.type}</span> {e.message}</li>)}</ul></div></>);
}
