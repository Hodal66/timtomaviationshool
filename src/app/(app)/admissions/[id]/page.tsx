import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { label, money } from "@/lib/format";
import { ensureIntake, SESSIONS, upcomingIntakes } from "@/lib/intakes";
import { COPY, notifyApplicant, waLink } from "@/lib/notify";
export const dynamic = "force-dynamic";

async function guard() { const s = await getSession(); if (!s || !can.admissions(s.role)) throw new Error("Not allowed"); return s; }
const back = (id: string) => { revalidatePath(`/admissions/${id}`); revalidatePath("/admissions"); redirect(`/admissions/${id}`); };

async function setDoc(status: string, fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id")), docId = String(fd.get("docId"));
  if (!["RECEIVED", "VERIFIED", "MISSING", "PENDING"].includes(status)) return;
  const d = await db.documentItem.update({ where: { id: docId }, data: { status: status as never, note: String(fd.get("note") ?? "").trim() || null } });
  await db.applicationEvent.create({ data: { applicantId: id, type: "DOC", actorName: s.name, message: `${d.kind}: ${label(status)}${status === "MISSING" ? " (applicant must provide it)" : ""}` } });
  if (status === "MISSING") await notifyApplicant(id, (a) => COPY.docMissing(a, d.kind));
  back(id);
}
async function addNote(fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id")), m = String(fd.get("note") ?? "").trim().slice(0, 1000);
  if (m) await db.applicationEvent.create({ data: { applicantId: id, type: "NOTE", actorName: s.name, message: m } });
  back(id);
}
/** ADM-06: the officer confirms each entry requirement of the programme; admission is blocked until all are confirmed. */
async function setRequirements(fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id"));
  const a = await db.applicant.findUnique({ where: { id }, include: { programme: { select: { entryRequirements: true } } } }); if (!a) return;
  const met = a.programme.entryRequirements.filter((r, i) => fd.get("req" + i) === "on");
  await db.applicant.update({ where: { id }, data: { requirementsMet: met } });
  await db.applicationEvent.create({ data: { applicantId: id, type: "SYSTEM", actorName: s.name, message: `Entry requirements confirmed: ${met.length} of ${a.programme.entryRequirements.length}.` } });
  back(id);
}
async function assign(fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id")), uid = String(fd.get("uid")) || null;
  await db.applicant.update({ where: { id }, data: { assignedToId: uid } });
  await db.applicationEvent.create({ data: { applicantId: id, type: "SYSTEM", actorName: s.name, message: uid ? "Assigned to an officer." : "Unassigned." } });
  back(id);
}
async function place(fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id"));
  const branchId = String(fd.get("branchId")), session = String(fd.get("session")), key = String(fd.get("start"));
  const a = await db.applicant.findUnique({ where: { id } }); const branch = await db.branch.findUnique({ where: { id: branchId } });
  if (!a || !branch || (session !== "WEEKDAY" && session !== "WEEKEND")) return;
  const intake = key === "keep" ? await db.intake.findUnique({ where: { id: a.intakeId } }) : await ensureIntake(key);
  if (!intake) return;
  await db.applicant.update({ where: { id }, data: { branchId: branch.id, session, intakeId: intake.id, classGroupId: null,
    events: { create: { type: "PLACEMENT", actorName: s.name, message: `Placement set to ${branch.name}, ${SESSIONS[session].label.toLowerCase()} schedule, ${intake.label} intake.` } } } });
  await notifyApplicant(id, COPY.placement);
  back(id);
}
async function raiseInvoice(fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id"));
  const amount = parseInt(String(fd.get("amount") ?? "").replace(/\D/g, ""), 10), description = String(fd.get("description") ?? "").trim().slice(0, 120);
  const a = await db.applicant.findUnique({ where: { id }, include: { _count: { select: { invoices: true } } } });
  if (!a || !amount || !description) return;
  const reference = `INV-${a.reference ?? a.id.slice(-6).toUpperCase()}${a._count.invoices ? `-${a._count.invoices + 1}` : ""}`;
  await db.invoice.create({ data: { reference, applicantId: id, description, amountMinor: amount, currency: "RWF" } });
  await db.applicationEvent.create({ data: { applicantId: id, type: "PAYMENT", actorName: s.name, message: `Invoice ${reference} raised: ${description}, RWF ${amount.toLocaleString("en-US")}.` } });
  await notifyApplicant(id, (ap) => COPY.invoice(ap, reference, description, amount));
  back(id);
}

async function decide(fd: FormData) {
  "use server";
  const s = await guard(); const id = String(fd.get("id")), op = String(fd.get("op"));
  const a = await db.applicant.findUnique({ where: { id } });
  if (!a) return;
  if (op === "reject") {
    const reason = String(fd.get("reason") ?? "").trim().slice(0, 300);
    await db.applicant.update({ where: { id }, data: { status: "REJECTED", events: { create: [{ type: "STATUS", actorName: s.name, message: "Application not admitted." }, ...(reason ? [{ type: "NOTE", actorName: s.name, message: `Reason: ${reason}` }] : [])] } } });
    await notifyApplicant(id, (ap) => COPY.status(ap, "REJECTED"));
  }
  if (op === "reopen" && a.status === "REJECTED") await db.applicant.update({ where: { id }, data: { status: "SUBMITTED", events: { create: { type: "STATUS", actorName: s.name, message: "Reopened." } } } });
  back(id);
}

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  { const me = await getSession(); if (!me || !can.viewApplicants(me.role)) redirect("/dashboard"); }
  const a = await db.applicant.findUnique({ where: { id }, include: { programme: true, intake: true, branch: true, documents: true, invoices: true, events: { orderBy: { createdAt: "desc" } }, assignedTo: true, uploads: { select: { id: true, kind: true, filename: true, size: true, mime: true } }, notifications: { orderBy: { createdAt: "desc" }, take: 20 } } });
  if (!a) notFound();
  const [branches, intakes] = await Promise.all([db.branch.findMany({ orderBy: { code: "asc" } }), db.intake.findMany({ orderBy: { startsOn: "asc" } })]);
  const officers = await db.user.findMany({ where: { role: { in: ["ADMISSIONS", "ADMIN"] } }, orderBy: { name: "asc" } });
  return (<><div className="top"><h1>{a.fullName}</h1><p>{a.reference} · {a.programme.name} · {a.intake.label} · {a.branch.name} · {a.session === "WEEKDAY" ? "Weekday" : "Weekend"} · <span className="pill">{label(a.status)}</span></p></div>
    <div className="panel" style={{ marginBottom: 16 }}><h2>Contact and source</h2>
      <p style={{ margin: 0 }}>Phone: {a.phone ?? "-"} · Email: {a.email ?? "-"} · Born: {a.dateOfBirth?.toISOString().slice(0, 10) ?? "-"}</p>
      {a.educationLevel && <p style={{ margin: "4px 0 0" }}>Education: {a.educationLevel}, {a.institution} ({a.completionYear})</p>}
      {a.guardianName && <p style={{ margin: "4px 0 0" }}>Guardian: {a.guardianName} ({a.guardianPhone})</p>}
      <p style={{ margin: "4px 0 0" }}>Source: {a.leadSource ?? a.source}{a.utmCampaign ? ` · campaign ${a.utmCampaign}` : ""}{a.language ? ` · language ${a.language}` : ""}</p>
      <form action={assign} style={{ marginTop: 10, display: "flex", gap: 8 }}><input type="hidden" name="id" value={a.id} />
        <select name="uid" defaultValue={a.assignedToId ?? ""} aria-label="Assigned officer"><option value="">Unassigned</option>{officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select><button type="submit">Assign</button></form></div>
    <div className="panel" style={{ marginBottom: 16 }}><h2>Placement</h2>
      <p style={{ margin: "0 0 10px", color: "var(--muted)" }}>Applied for {a.intake.label}, {a.branch.name}, {a.session === "WEEKDAY" ? "weekday" : "weekend"}. Change it if the applicant agrees a different intake, branch or schedule.</p>
      <form action={place} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input type="hidden" name="id" value={a.id} />
        <select name="branchId" defaultValue={a.branchId} aria-label="Branch">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select name="session" defaultValue={a.session} aria-label="Schedule"><option value="WEEKDAY">Weekday</option><option value="WEEKEND">Weekend</option></select>
        <select name="start" defaultValue="keep" aria-label="Intake"><option value="keep">Keep {a.intake.label}</option>{upcomingIntakes(6).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
        <button type="submit">Update placement</button></form>{void intakes}</div>
    <div className="panel" style={{ marginBottom: 16 }}><h2>Entry requirements</h2>
      {a.programme.entryRequirements.length === 0 ? <p style={{ margin: 0, color: "var(--muted)" }}>This programme has no entry requirements set. Add them on the course page if needed.</p>
      : <form action={setRequirements} style={{ display: "grid", gap: 6 }}><input type="hidden" name="id" value={a.id} />
        {a.programme.entryRequirements.map((r, i) => <label key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="checkbox" name={"req" + i} defaultChecked={a.requirementsMet.includes(r)} style={{ minHeight: 0, width: 18, height: 18, padding: 0, marginTop: 2 }} /><span>{r}</span></label>)}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}><button type="submit">Save requirements</button><span className={`pill ${a.programme.entryRequirements.every((r) => a.requirementsMet.includes(r)) ? "ok" : "warn"}`}>{a.programme.entryRequirements.filter((r) => a.requirementsMet.includes(r)).length} of {a.programme.entryRequirements.length} confirmed</span></div></form>}
      {["ADMITTED", "ENROLLED"].includes(a.status) && <p style={{ margin: "12px 0 0" }}><a className="btn-p" style={{ display: "inline-block", padding: "8px 14px", borderRadius: 10, textDecoration: "none" }} href={`/api/letters/${a.reference}`}>Download admission letter (PDF)</a></p>}</div>
    <div className="panel tbl" style={{ marginBottom: 16 }}><h2>Documents</h2><table><thead><tr><th>Document</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {a.documents.map((d) => <tr key={d.id}><td>{d.kind}{d.note && <small style={{ display: "block", color: "var(--muted)" }}>{d.note}</small>}{a.uploads.filter((u) => u.kind === d.kind).map((u) => <small key={u.id} style={{ display: "block" }}><a href={`/api/documents/${u.id}`} target="_blank" rel="noreferrer">View {u.filename}</a> ({Math.max(1, Math.round(u.size / 1024))} KB)</small>)}</td><td><span className={`pill ${d.status === "VERIFIED" ? "ok" : d.status === "MISSING" ? "bad" : "warn"}`}>{label(d.status)}</span></td>
        <td><form style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="docId" value={d.id} /><input name="note" placeholder="Note" aria-label="Note" style={{ width: 150 }} />
          <button className="s" formAction={setDoc.bind(null, "RECEIVED")}>Received</button><button className="s" formAction={setDoc.bind(null, "VERIFIED")}>Verify</button><button className="s" formAction={setDoc.bind(null, "MISSING")}>Request again</button></form></td></tr>)}
    </tbody></table><p style={{ color: "var(--muted)", marginBottom: 0 }}>Requesting a document again records it on the application. Messages to the applicant are not sent automatically yet.</p></div>
    <div className="panel tbl" style={{ marginBottom: 16 }}><h2>Invoice and payment</h2>
      {a.invoices.length === 0 ? <p>No invoice. This course has no registration fee set.</p> : <table><tbody>{a.invoices.map((i) => <tr key={i.id}><td>{i.reference}</td><td>{i.description}</td><td>{money(i.amountMinor, i.currency)}</td><td><span className={`pill ${i.status === "PAID" ? "ok" : "warn"}`}>{label(i.status)}</span></td></tr>)}</tbody></table>}
      <form action={raiseInvoice} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}><input type="hidden" name="id" value={a.id} />
        <input name="description" placeholder="Description, e.g. Tuition deposit" aria-label="Invoice description" required style={{ minWidth: 240 }} /><input name="amount" inputMode="numeric" placeholder="Amount (RWF)" aria-label="Amount in RWF" required style={{ width: 140 }} /><button type="submit">Raise invoice</button></form>
      <p style={{ color: "var(--muted)", marginBottom: 0 }}>Only Finance can mark an invoice paid, on the <a href="/payments">Payments</a> page.</p></div>
    <div className="panel tbl" style={{ marginBottom: 16 }}><h2>Messages to the applicant</h2>
      <table><tbody>{a.notifications.length === 0 && <tr><td>No messages yet.</td></tr>}
        {a.notifications.map((n) => <tr key={n.id}><td>{n.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td>{n.channel === "EMAIL" ? "Email" : "WhatsApp"}</td><td style={{ whiteSpace: "normal" }}>{n.subject ?? n.template}</td>
          <td><span className={`pill ${n.status === "SENT" ? "ok" : n.status === "FAILED" ? "bad" : "warn"}`}>{n.status === "QUEUED" && n.channel === "WHATSAPP" ? "To send" : label(n.status)}</span>{n.error && <small style={{ display: "block", color: "var(--muted)", whiteSpace: "normal", maxWidth: 260 }}>{n.error}</small>}</td>
          <td>{n.channel === "WHATSAPP" && n.status === "QUEUED" && waLink(n.to, n.body) && <a href={waLink(n.to, n.body)!} target="_blank" rel="noreferrer">Open WhatsApp</a>}</td></tr>)}</tbody></table>
      {a.phone && waLink(a.phone, `Hello ${a.fullName.split(" ")[0]}, this is Timtom Aviation School about your application ${a.reference}.`) && <p style={{ marginBottom: 0 }}><a href={waLink(a.phone, `Hello ${a.fullName.split(" ")[0]}, this is Timtom Aviation School about your application ${a.reference}.`)!} target="_blank" rel="noreferrer">Start a WhatsApp chat</a></p>}</div>
    <div className="panel" style={{ marginBottom: 16 }}><h2>Decision</h2>
      {a.status === "REJECTED" ? <form action={decide}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="reopen" /><button type="submit">Reopen application</button></form> :
        <form action={decide} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="reject" /><input name="reason" placeholder="Reason" aria-label="Reason" style={{ minWidth: 260 }} /><button type="submit">Not admitted</button></form>}
      <p style={{ color: "var(--muted)", marginBottom: 0 }}>To move forward, use Next stage on the <a href="/admissions">board</a>. Rules: documents verified, then invoice paid, then admitted, then enrolled.</p></div>
    <div className="panel"><h2>Notes and history</h2>
      <form action={addNote} style={{ display: "flex", gap: 8, marginBottom: 12 }}><input type="hidden" name="id" value={a.id} /><input name="note" placeholder="Internal note" aria-label="Internal note" style={{ flex: 1 }} /><button className="p" type="submit">Add note</button></form>
      <ul className="ol">{a.events.map((e) => <li key={e.id}>{e.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {e.actorName} · <span className="pill">{e.type}</span> {e.message}</li>)}</ul></div></>);
}
