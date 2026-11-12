import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { advanceApplicant } from "@/lib/admissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STAGES, label } from "@/lib/format";
export const dynamic = "force-dynamic";

async function advance(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !can.admissions(s.role)) throw new Error("Not allowed");
  const err = await advanceApplicant(String(fd.get("id")), s.name);
  revalidatePath("/admissions");
  if (err) redirect(`/admissions?e=${encodeURIComponent(err)}`);
}

export default async function Admissions({ searchParams }: { searchParams: Promise<{ q?: string; branch?: string; course?: string; intake?: string; e?: string }> }) {
  const me = await getSession(); if (!me || !can.viewApplicants(me.role)) redirect("/dashboard");
  const sp = await searchParams;
  const q = sp.q?.trim();
  const [apps, branches, courses, intakes] = await Promise.all([
    db.applicant.findMany({
      where: { ...(sp.branch ? { branchId: sp.branch } : {}), ...(sp.course ? { programmeId: sp.course } : {}), ...(sp.intake ? { intakeId: sp.intake } : {}),
        ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { reference: { contains: q.toUpperCase() } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}) },
      include: { branch: true, programme: true, intake: true, documents: true, invoices: true, assignedTo: true }, orderBy: { createdAt: "asc" } }),
    db.branch.findMany(), db.programme.findMany({ orderBy: { name: "asc" } }), db.intake.findMany({ orderBy: { startsOn: "asc" } }),
  ]);
  const rejected = apps.filter((a) => a.status === "REJECTED").length;
  return (<><div className="top"><h1>Admissions</h1><p>Applications from the website arrive here automatically. Open a card for documents, notes and the decision.</p></div>
    <form className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      <input name="q" defaultValue={q ?? ""} placeholder="Search name, reference, phone, email" aria-label="Search" style={{ minWidth: 260 }} />
      <select name="branch" defaultValue={sp.branch ?? ""} aria-label="Branch"><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <select name="course" defaultValue={sp.course ?? ""} aria-label="Course"><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select name="intake" defaultValue={sp.intake ?? ""} aria-label="Intake"><option value="">All intakes</option>{intakes.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select>
      <button type="submit">Filter</button></form>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}
    <div className="kan">{STAGES.map((st) => { const col = apps.filter((a) => a.status === st);
      return (<div className="col" key={st}><h2>{label(st)}<span>{col.length}</span></h2>
        {col.map((a) => { const verified = a.documents.filter((d) => d.status === "VERIFIED").length; const inv = a.invoices[0];
          return (<div className="card" key={a.id}><a href={`/admissions/${a.id}`}><b>{a.fullName}</b></a>
            <small>{a.reference ?? "No reference"} · {a.programme.name}</small><small>{a.intake.label} · {a.session === "WEEKDAY" ? "Weekday" : "Weekend"}</small>
            <span className="pill">{a.branch.name}</span>{" "}{a.status === "SUBMITTED" && Date.now() - +a.createdAt < 48 * 36e5 && <><span className="pill ok">New</span>{" "}</>}
            <span className={`pill ${a.documents.length && verified === a.documents.length ? "ok" : "warn"}`}>Docs {verified}/{a.documents.length}</span>{" "}
            <span className={`pill ${!inv ? "" : inv.status === "PAID" ? "ok" : "warn"}`}>{!inv ? "No invoice" : inv.status === "PAID" ? "Paid" : "Unpaid"}</span>
            {a.assignedTo && <small>Officer: {a.assignedTo.name}</small>}
            {st !== "ENROLLED" && <form action={advance}><input type="hidden" name="id" value={a.id} /><button className="s" type="submit">Next stage</button></form>}
          </div>); })}</div>); })}</div>
    {rejected > 0 && <p className="note" style={{ color: "var(--muted)" }}>{rejected} application(s) in this view were not admitted and are hidden from the board.</p>}</>);
}
