import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { label } from "@/lib/format";
import { MANAGERS } from "@/lib/lecturers";
import { saveVacancy, setVacancyStatus } from "@/lib/recruitment";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
export const dynamic = "force-dynamic";

async function save(fd: FormData) {
  "use server";
  const s = await getSession(); if (!s || !MANAGERS.includes(s.role)) throw new Error("Not allowed"); const id = String(fd.get("id") ?? "") || undefined;
  const r = await saveVacancy({ uid: s.uid, name: s.name, role: s.role }, Object.fromEntries(["title", "description", "subjects", "requirements", "branchId", "payModel", "closesOn"].map((k) => [k, String(fd.get(k) ?? "")])), id);
  revalidateTag("careers"); revalidatePath("/recruitment"); redirect("/recruitment?" + (typeof r === "string" ? "e=" + encodeURIComponent(r) : "ok=1"));
}
async function status(to: "DRAFT" | "PUBLISHED" | "CLOSED", fd: FormData) {
  "use server";
  const s = await getSession(); if (!s || !MANAGERS.includes(s.role)) throw new Error("Not allowed");
  const err = await setVacancyStatus({ uid: s.uid, name: s.name, role: s.role }, String(fd.get("id")), to); revalidateTag("careers"); revalidatePath("/recruitment"); redirect("/recruitment?" + (err ? "e=" + encodeURIComponent(err) : "ok=1"));
}
const pill = (s: string) => (["PUBLISHED", "HIRED"].includes(s) ? "ok" : ["CLOSED", "REJECTED", "WITHDRAWN"].includes(s) ? "bad" : "warn");

/** LEC-07, LEC-08: vacancies and the applicant pipeline. */
export default async function Recruitment({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string; edit?: string }> }) {
  const me = await getSession(); if (!me || !MANAGERS.includes(me.role)) redirect("/dashboard"); const { t } = await getT(); const sp = await searchParams;
  const [vacs, apps, branches] = await Promise.all([db.vacancy.findMany({ include: { branch: true, _count: { select: { applications: true } } }, orderBy: { createdAt: "desc" } }), db.jobApplication.findMany({ include: { vacancy: { select: { title: true } } }, omit: { cv: true }, orderBy: { createdAt: "desc" }, take: 500 }), db.branch.findMany({ orderBy: { name: "asc" } })]);
  const ed = vacs.find((v) => v.id === sp.edit);
  const cols: Col[] = [{ key: "name", label: t("Candidate"), sortable: true }, { key: "vacancy", label: t("Vacancy"), filter: true }, { key: "status", label: t("Status"), filter: true }, { key: "score", label: t("Screening score"), sortable: true, align: "right" }, { key: "date", label: t("Applied"), sortable: true }, { key: "email", label: t("Email"), hidden: true }, { key: "phone", label: t("Phone"), hidden: true }, { key: "ref", label: t("Reference"), hidden: true }];
  const rows: Row[] = apps.map((j) => ({ id: j.id, v: { name: j.fullName, vacancy: j.vacancy.title, status: t(label(j.status)), score: j.score, date: j.createdAt.toISOString().slice(0, 10), email: j.email, phone: j.phone, ref: j.reference },
    c: { name: <a href={`/recruitment/${j.id}`}>{j.fullName}</a>, status: <span className={`pill ${pill(j.status)}`}>{t(label(j.status))}</span>, score: j.score == null ? "-" : `${j.score}%` } }));
  return (<><div className="top"><div><h1>{t("Recruitment")}</h1><p>{t("Publish lecturer vacancies on the website, screen applications, make offers and onboard new lecturers.")}</p></div><a href="/careers" target="_blank" rel="noopener">{t("Open the careers page")}</a></div>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="ok" role="status">{t("Saved.")}</p>}
    <div className="grid2" style={{ marginBottom: 16 }}>
      <form className="panel" style={{ display: "grid", gap: 8 }} action={save} id="vacancy-form"><h2 style={{ margin: 0 }}>{ed ? t("Edit vacancy") : t("New vacancy")}</h2>{ed && <input type="hidden" name="id" value={ed.id} />}
        <label htmlFor="vf-t">{t("Title")}</label><input id="vf-t" name="title" required defaultValue={ed?.title} placeholder="Lecturer, Air Cargo Operations" />
        <label htmlFor="vf-d">{t("Description")}</label><textarea id="vf-d" name="description" rows={4} required defaultValue={ed?.description} />
        <label htmlFor="vf-s">{t("Subjects (comma separated)")}</label><input id="vf-s" name="subjects" defaultValue={ed?.subjects.join(", ")} />
        <label htmlFor="vf-r">{t("Requirements (one per line; applicants answer yes or no)")}</label><textarea id="vf-r" name="requirements" rows={3} defaultValue={ed?.requirements.join("\n")} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>{t("Branch")}<br /><select name="branchId" defaultValue={ed?.branchId ?? ""}><option value="">{t("Any branch")}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label>{t("Pay model")}<br /><select name="payModel" defaultValue={ed?.payModel ?? "HOUR"}>{["HOUR", "SESSION", "MODULE", "MONTHLY"].map((m) => <option key={m} value={m}>{t(label(m))}</option>)}</select></label>
          <label>{t("Closing date")}<br /><input type="date" name="closesOn" defaultValue={ed?.closesOn?.toISOString().slice(0, 10)} /></label></div>
        <button className="p" type="submit" style={{ justifySelf: "start" }}>{ed ? t("Save vacancy") : t("Create vacancy")}</button></form>
      <div className="panel"><h2>{t("Vacancies")}</h2>{vacs.length === 0 ? <p className="empty">{t("No vacancies yet.")}</p> : <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>{vacs.map((v) => <li key={v.id} data-vac={v.title} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{v.title}</b><span className={`pill ${pill(v.status)}`}>{t(label(v.status))}</span></div>
        <small style={{ color: "var(--muted)" }}>{[v.branch?.name, v.closesOn && `${t("Closes")} ${v.closesOn.toISOString().slice(0, 10)}`, t("{n} applications", { n: v._count.applications })].filter(Boolean).join(" · ")}</small>
        <form style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}><input type="hidden" name="id" value={v.id} /><a className="btn s" href={`/recruitment?edit=${v.id}`}>{t("Edit")}</a>
          {v.status !== "PUBLISHED" && <button className="s p" formAction={status.bind(null, "PUBLISHED")}>{t("Publish")}</button>}{v.status === "PUBLISHED" && <><a className="btn s" href={`/careers/${v.slug}`} target="_blank" rel="noopener">{t("View")}</a><button className="s" formAction={status.bind(null, "CLOSED")}>{t("Close")}</button></>}</form></li>)}</ul>}</div></div>
    <div className="panel"><h2>{t("Applications")}</h2><DataTable id="jobapps" cols={cols} rows={rows} exportName="job-applications" empty={t("No applications yet.")} /></div></>);
}
