import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { STAGES, label } from "@/lib/format";
export const dynamic = "force-dynamic";

async function advance(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !["ADMIN", "ADMISSIONS", "BRANCH_MANAGER"].includes(s.role)) throw new Error("Not allowed");
  const a = await db.applicant.findUnique({ where: { id: String(fd.get("id")) } });
  if (!a) return;
  const i = STAGES.indexOf(a.status as (typeof STAGES)[number]);
  if (i < 0 || i >= STAGES.length - 1) return;
  await db.applicant.update({ where: { id: a.id }, data: { status: STAGES[i + 1] } });
  revalidatePath("/admissions");
}

async function addApplicant(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !["ADMIN", "ADMISSIONS", "BRANCH_MANAGER"].includes(s.role)) throw new Error("Not allowed");
  const fullName = String(fd.get("fullName") ?? "").trim();
  if (!fullName) return;
  await db.applicant.create({ data: {
    fullName, source: "Walk-in",
    branchId: String(fd.get("branchId")), programmeId: String(fd.get("programmeId")), intakeId: String(fd.get("intakeId")),
  } });
  revalidatePath("/admissions");
}

export default async function Admissions() {
  const [apps, branches, programmes, intakes] = await Promise.all([
    db.applicant.findMany({ include: { branch: true, programme: true }, orderBy: { createdAt: "asc" } }),
    db.branch.findMany(), db.programme.findMany(), db.intake.findMany({ orderBy: { startsOn: "asc" } }),
  ]);
  return (<><div className="top"><h1>Admissions</h1><p>Move an applicant to the next stage once the step is done.</p></div>
    <div className="kan">{STAGES.map((st) => { const col = apps.filter((a) => a.status === st);
      return (<div className="col" key={st}><h2>{label(st)}<span>{col.length}</span></h2>
        {col.map((a) => (<div className="card" key={a.id}><b>{a.fullName}</b><small>{a.programme.name}</small>
          <span className="pill">{a.branch.name}</span>
          {st !== "ENROLLED" && <form action={advance}><input type="hidden" name="id" value={a.id} /><button className="s" type="submit">Next stage</button></form>}
        </div>))}</div>); })}</div>
    <form action={addApplicant} className="panel" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <label htmlFor="fullName" style={{ width: "100%" }}><b>Add walk-in applicant</b></label>
      <input id="fullName" name="fullName" placeholder="Full name" required />
      <select id="programmeId" name="programmeId" aria-label="Programme">{programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select id="branchId" name="branchId" aria-label="Branch">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <select id="intakeId" name="intakeId" aria-label="Intake">{intakes.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select>
      <button className="p" type="submit">Add</button>
    </form></>);
}
