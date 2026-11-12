import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { advanceApplicant } from "@/lib/admissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STAGES, label } from "@/lib/format";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

async function advance(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !can.admissions(s.role)) throw new Error("Not allowed");
  const err = await advanceApplicant(String(fd.get("id")), s.name);
  revalidatePath("/admissions");
  if (err) redirect(`/admissions?e=${encodeURIComponent(err)}`);
}

async function advanceMany(ids: string[]) {
  "use server";
  const s = await getSession();
  if (!s || !can.admissions(s.role)) throw new Error("Not allowed");
  for (const id of ids.slice(0, 100)) await advanceApplicant(String(id), s.name);
  revalidatePath("/admissions");
}

export default async function Admissions({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; branch?: string; course?: string; intake?: string; e?: string }> }) {
  const me = await getSession(); if (!me || !can.viewApplicants(me.role)) redirect("/dashboard");
  const sp = await searchParams; const { t } = await getT(); const board = sp.view === "board";
  const q = sp.q?.trim();
  const [apps, branches, courses, intakes] = await Promise.all([
    db.applicant.findMany({
      where: { ...(sp.branch ? { branchId: sp.branch } : {}), ...(sp.course ? { programmeId: sp.course } : {}), ...(sp.intake ? { intakeId: sp.intake } : {}),
        ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { reference: { contains: q.toUpperCase() } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}) },
      include: { branch: true, programme: true, intake: true, documents: true, invoices: true, assignedTo: true }, orderBy: { createdAt: "asc" } }),
    db.branch.findMany(), db.programme.findMany({ orderBy: { name: "asc" } }), db.intake.findMany({ orderBy: { startsOn: "asc" } }),
  ]);
  const rejected = apps.filter((a) => a.status === "REJECTED").length;
  const cols: Col[] = [{ key: "ref", label: t("Reference") }, { key: "name", label: t("Applicant") }, { key: "programme", label: t("Programme"), filter: true }, { key: "branch", label: t("Branch"), filter: true }, { key: "intake", label: t("Intake"), filter: true, hidden: true },
    { key: "session", label: t("Session"), hidden: true }, { key: "status", label: t("Status"), filter: true }, { key: "docs", label: t("Documents") }, { key: "pay", label: t("Payment"), filter: true }, { key: "officer", label: t("Officer"), hidden: true }, { key: "email", label: "Email", hidden: true }, { key: "phone", label: t("Phone"), hidden: true }, { key: "applied", label: t("Applied") }, { key: "act", label: "", sortable: false }];
  const rows: Row[] = apps.filter((a) => a.status !== "REJECTED" || board === false).map((a) => { const verified = a.documents.filter((d) => d.status === "VERIFIED").length; const inv = a.invoices[0]; const pay = !inv ? t("No invoice") : inv.status === "PAID" ? t("Paid") : t("Unpaid");
    return { id: a.id, v: { ref: a.reference ?? "", name: a.fullName, programme: a.programme.name, branch: a.branch.name, intake: a.intake.label, session: a.session === "WEEKDAY" ? "Weekday" : "Weekend", status: label(a.status), docs: `${verified}/${a.documents.length}`, pay, officer: a.assignedTo?.name ?? "", email: a.email ?? "", phone: a.phone ?? "", applied: a.createdAt.toISOString().slice(0, 10) },
      c: { name: <a href={`/admissions/${a.id}`}><b>{a.fullName}</b></a>, status: <span className={`pill ${a.status === "ENROLLED" ? "ok" : a.status === "REJECTED" ? "bad" : ""}`}>{label(a.status)}</span>, docs: <span className={`pill ${a.documents.length && verified === a.documents.length ? "ok" : "warn"}`}>{verified}/{a.documents.length}</span>, pay: <span className={`pill ${!inv ? "" : inv.status === "PAID" ? "ok" : "warn"}`}>{pay}</span>,
        act: <span style={{ display: "flex", gap: 6 }}><a className="s" style={{ padding: "4px 10px", border: "1px solid var(--line)", borderRadius: 10, textDecoration: "none" }} href={`/admissions/${a.id}`}>{t("Open")}</a>{a.status !== "ENROLLED" && a.status !== "REJECTED" && <form action={advance}><input type="hidden" name="id" value={a.id} /><button className="s" type="submit">{t("Next stage")}</button></form>}</span> } }; });
  const tabs = (<div className="tabs" role="tablist"><a href="?view=table"><button role="tab" aria-selected={!board}>{t("Table")}</button></a><a href="?view=board"><button role="tab" aria-selected={board}>{t("Board")}</button></a></div>);
  return (<><div className="top"><div><h1>{t("Admissions")}</h1><p>{t("Applications from the website arrive here automatically. Open a record for documents, notes and the decision.")}</p></div></div>
    <form className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      <input type="hidden" name="view" value={board ? "board" : "table"} />
      <input name="q" defaultValue={q ?? ""} placeholder={t("Search name, reference, phone, email")} aria-label={t("Search")} style={{ minWidth: 260 }} />
      <select name="branch" defaultValue={sp.branch ?? ""} aria-label={t("Branch")}><option value="">{t("All branches")}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <select name="course" defaultValue={sp.course ?? ""} aria-label={t("Programme")}><option value="">{t("All courses")}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select name="intake" defaultValue={sp.intake ?? ""} aria-label={t("Intake")}><option value="">{t("All intakes")}</option>{intakes.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select>
      <button type="submit">{t("Filter")}</button></form>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}
    {tabs}
    {!board && <div className="panel"><DataTable id="admissions" cols={cols} rows={rows} exportName="admissions" empty={t("No applications match.")} bulk={can.admissions(me.role) ? [{ label: t("Move to next stage"), run: advanceMany }] : undefined} /></div>}
    {board && <><div className="kan">{STAGES.map((st) => { const col = apps.filter((a) => a.status === st);
      return (<div className="col" key={st}><h2>{label(st)}<span>{col.length}</span></h2>
        {col.map((a) => { const verified = a.documents.filter((d) => d.status === "VERIFIED").length; const inv = a.invoices[0];
          return (<div className="card" key={a.id}><a href={`/admissions/${a.id}`}><b>{a.fullName}</b></a>
            <small>{a.reference ?? "No reference"} · {a.programme.name}</small><small>{a.intake.label} · {a.session === "WEEKDAY" ? "Weekday" : "Weekend"}</small>
            <span className="pill">{a.branch.name}</span>{" "}{a.status === "SUBMITTED" && Date.now() - +a.createdAt < 48 * 36e5 && <><span className="pill ok">New</span>{" "}</>}
            <span className={`pill ${a.documents.length && verified === a.documents.length ? "ok" : "warn"}`}>Docs {verified}/{a.documents.length}</span>{" "}
            <span className={`pill ${!inv ? "" : inv.status === "PAID" ? "ok" : "warn"}`}>{!inv ? "No invoice" : inv.status === "PAID" ? "Paid" : "Unpaid"}</span>
            {a.assignedTo && <small>Officer: {a.assignedTo.name}</small>}
            {st !== "ENROLLED" && <form action={advance}><input type="hidden" name="id" value={a.id} /><button className="s" type="submit">{t("Next stage")}</button></form>}
          </div>); })}</div>); })}</div>
    {rejected > 0 && <p style={{ color: "var(--muted)" }}>{rejected} application(s) in this view were not admitted and are hidden from the board.</p>}</>}</>);
}
