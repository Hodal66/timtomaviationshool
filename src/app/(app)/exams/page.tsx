import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { label } from "@/lib/format";
import { updateExam, EXAM_STATUSES } from "@/lib/certificates";
export const dynamic = "force-dynamic";
const ROLES = ["ADMIN", "ACADEMIC", "ADMISSIONS"];
async function save(fd: FormData) { "use server"; const s = await getSession(); if (!s || !ROLES.includes(s.role)) throw new Error("Not allowed"); const g = (k: string) => String(fd.get(k) ?? "");
  const err = await updateExam({ uid: s.uid, name: s.name, role: s.role }, g("id"), { status: g("status"), feeAmount: g("feeAmount"), feeCurrency: g("feeCurrency"), feePaidToBodyOn: g("feePaidToBodyOn"), examDate: g("examDate"), result: g("result"), certificateNo: g("certificateNo"), certificateReceivedOn: g("certificateReceivedOn") });
  revalidatePath("/exams"); redirect("/exams" + (err ? "?e=" + encodeURIComponent(err) : "?ok=1")); }
/** ASM-04: IATA and ICAO exam tracking. */
export default async function Exams({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const me = await getSession(); if (!me || !ROLES.includes(me.role)) redirect("/dashboard"); const { t } = await getT(); const sp = await searchParams;
  const rows = await db.externalExam.findMany({ include: { applicant: { include: { programme: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300 }); const d = (x: Date | null) => x?.toISOString().slice(0, 10) ?? "";
  return (<><div className="top"><div><h1>{t("IATA and ICAO exams")}</h1><p>{t("Track each registration: the fee paid on to IATA or ICAO, the exam date, the result and the certificate received.")}</p></div></div>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="ok" role="status">{t("Saved.")}</p>}{rows.length === 0 && <div className="panel empty">{t("No exam registrations yet. Students ask for one from their dashboard.")}</div>}
    <div style={{ display: "grid", gap: 12 }}>{rows.map((x) => <form action={save} key={x.id} className="panel" data-exam={x.id} style={{ display: "grid", gap: 8 }}><input type="hidden" name="id" value={x.id} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><div><span className="pill warn">{x.body}</span> <b>{x.examName}</b> · <a href={`/admissions/${x.applicantId}`}>{x.applicant.fullName}</a> <small style={{ color: "var(--muted)" }}>{x.applicant.programme.name}</small></div><span className={`pill ${x.status === "PASSED" ? "ok" : x.status === "FAILED" || x.status === "CANCELLED" ? "bad" : ""}`}>{label(x.status)}</span></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label>{t("Status")}<br /><select name="status" defaultValue={x.status}>{EXAM_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label>{t("Fee")}<br /><input name="feeAmount" type="number" min={0} defaultValue={x.feeAmount ?? ""} style={{ width: 110 }} /></label><label>{t("Currency")}<br /><select name="feeCurrency" defaultValue={x.feeCurrency}><option>USD</option><option>RWF</option></select></label>
        <label>{t("Fee paid to")} {x.body}<br /><input name="feePaidToBodyOn" type="date" defaultValue={d(x.feePaidToBodyOn)} /></label><label>{t("Exam date")}<br /><input name="examDate" type="date" defaultValue={d(x.examDate)} /></label><label>{t("Result")}<br /><input name="result" defaultValue={x.result ?? ""} style={{ width: 130 }} /></label>
        <label>{x.body} {t("certificate number")}<br /><input name="certificateNo" defaultValue={x.certificateNo ?? ""} style={{ width: 150 }} /></label><label>{t("Certificate received")}<br /><input name="certificateReceivedOn" type="date" defaultValue={d(x.certificateReceivedOn)} /></label><button className="p" type="submit">{t("Save")}</button></div></form>)}</div></>);
}
