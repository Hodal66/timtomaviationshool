import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { db } from "@/lib/db";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
import { getT } from "@/lib/i18n/server";
import { revokeCertificate, reissueCertificate } from "@/lib/certificates";
export const dynamic = "force-dynamic";
const actor = async () => { const s = await getSession(); if (!s) throw new Error("Not allowed"); return { uid: s.uid, name: s.name, role: s.role }; };
const done = (e?: string | null, ok?: string) => { revalidatePath("/certificates"); redirect("/certificates" + (e ? "?e=" + encodeURIComponent(e) : ok ? "?ok=" + encodeURIComponent(ok) : "")); };
async function revoke(fd: FormData) { "use server"; done(await revokeCertificate(await actor(), String(fd.get("number")), String(fd.get("reason") ?? "")), "Certificate revoked."); }
async function reissue(fd: FormData) { "use server"; const r = await reissueCertificate(await actor(), String(fd.get("number"))); done(typeof r === "string" ? r : null, typeof r === "string" ? undefined : `Reissued as ${r.number}.`); }

export default async function Certificates({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const me = await getSession(); if (!me || !can.reports(me.role)) redirect("/dashboard");
  const { t } = await getT(); const sp = await searchParams; const officer = can.approve(me.role);
  const [rows, ext] = await Promise.all([db.certificate.findMany({ include: { holder: true, programme: true }, orderBy: { issuedOn: "desc" } }), db.externalExam.findMany({ where: { certificateNo: { not: null } }, include: { applicant: true }, orderBy: { certificateReceivedOn: "desc" } })]);
  const cols: Col[] = [{ key: "no", label: t("Number") }, { key: "holder", label: t("Holder") }, { key: "prog", label: t("Programme"), filter: true }, { key: "kind", label: t("Type"), filter: true }, { key: "mark", label: t("Final mark"), align: "right" }, { key: "on", label: t("Issued") }, { key: "status", label: t("Status"), filter: true }, { key: "act", label: "", sortable: false }];
  const data: Row[] = rows.map((c) => ({ id: c.id, v: { no: c.number, holder: c.holder.fullName, prog: c.programme.name, kind: c.kind, mark: c.finalMark ?? "", on: c.issuedOn.toISOString().slice(0, 10), status: c.status === "VALID" ? "Valid" : "Revoked" },
    c: { no: <>{c.status === "VALID" ? <a href={`/api/certificates/${c.number}`}>{c.number}</a> : c.number}{c.replacesNumber && <small style={{ display: "block", color: "var(--muted)" }}>{t("replaces")} {c.replacesNumber}</small>}</>, status: <><span className={`pill ${c.status === "VALID" ? "ok" : "bad"}`}>{c.status === "VALID" ? "Valid" : "Revoked"}</span>{c.revokeReason && <small style={{ display: "block", color: "var(--muted)", whiteSpace: "normal", maxWidth: 240 }}>{c.revokedBy}, {c.revokedAt?.toISOString().slice(0, 10)}: {c.revokeReason}</small>}</>,
      act: !officer ? null : c.status === "VALID" ? <form action={revoke} style={{ display: "flex", gap: 4 }}><input type="hidden" name="number" value={c.number} /><input name="reason" placeholder={t("Reason")} aria-label={`${t("Reason")}: ${c.number}`} required minLength={5} style={{ width: 150 }} /><button className="s danger" type="submit">{t("Revoke")}</button></form> : rows.some((x) => x.replacesNumber === c.number) ? null : <form action={reissue}><input type="hidden" name="number" value={c.number} /><button className="s" type="submit">{t("Reissue")}</button></form> } }));
  return (<><div className="top"><div><h1>{t("Certificates")}</h1><p>{t("Certificates are issued from the Results table once a student has passed. Public verification at")} <a href="/verify">/verify</a></p></div></div>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="ok" role="status">{sp.ok}</p>}
    <div className="panel" style={{ marginBottom: 16 }}><h2>{t("School certificates")}</h2><DataTable id="certificates" cols={cols} rows={data} exportName="certificates" empty={t("No certificates yet.")} /></div>
    <div className="panel"><h2>{t("IATA and ICAO certificates received")}</h2><p style={{ margin: "0 0 10px", color: "var(--muted)" }}>{t("These certificates are issued by IATA or ICAO, not by the School. They are recorded here when the School receives them.")}</p>
      <DataTable id="ext-certs" exportName="iata-icao-certificates" empty={t("None recorded yet.")} cols={[{ key: "body", label: t("Issued by"), filter: true }, { key: "no", label: t("Number") }, { key: "holder", label: t("Holder") }, { key: "exam", label: t("Exam") }, { key: "on", label: t("Received") }]} rows={ext.map((x) => ({ id: x.id, v: { body: x.body, no: x.certificateNo ?? "", holder: x.applicant.fullName, exam: x.examName, on: x.certificateReceivedOn?.toISOString().slice(0, 10) ?? "" }, c: { body: <span className="pill warn">{t("Issued by")} {x.body}</span> } }))} /></div></>);
}
