import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { readIdToken } from "@/lib/student";
import { rateOf } from "@/lib/teaching";
import { IdMark } from "@/components/IdMark";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student ID | Timtom Aviation School", robots: { index: false } };
/** What a scan of the student ID shows: whether the card is genuine and the student is currently enrolled. Lecturers can mark attendance from here. */
export default async function IdPage({ params }: { params: Promise<{ token: string }> }) {
  const token = decodeURIComponent((await params).token); const id = readIdToken(token); const s = await getSession();
  const a = id ? await db.applicant.findUnique({ where: { id }, include: { programme: true, branch: true, classGroup: true, uploads: { where: { kind: "Profile photo" }, select: { id: true } }, attendance: { select: { status: true } } } }) : null;
  const ok = !!a && a.status === "ENROLLED"; const canMark = !!s && ["ADMIN", "BRANCH_MANAGER", "LECTURER"].includes(s.role);
  return (<div className="center"><div className="box" style={{ maxWidth: 420, textAlign: "center" }}>
    <h1 style={{ fontSize: 20 }}>Timtom Aviation School</h1>
    {!a ? <p className="err"><b>Not a valid student ID.</b> This code was not issued by the School.</p> : <>
      {a.uploads.length > 0 && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/id/${encodeURIComponent(token)}/photo`} alt={`Photo of ${a.fullName}`} width={120} height={120} style={{ borderRadius: "50%", objectFit: "cover", margin: "0 auto", border: "3px solid var(--line)" }} />}
      <p style={{ margin: 0 }}><span className={`pill ${ok ? "ok" : "bad"}`}>{ok ? "Valid student ID" : "Not currently enrolled"}</span></p>
      <h2 style={{ fontSize: 22 }}>{a.fullName}</h2><p style={{ margin: 0 }}>{a.programme.name}<br />{a.branch.name}{a.classGroup ? ` · ${a.classGroup.name}` : ""}<br />Student reference: <b>{a.reference}</b></p>
      {canMark && ok && <><p style={{ margin: 0, color: "var(--muted)" }}>Attendance: {rateOf(a.attendance.map((x) => x.status)) ?? "-"}%</p><IdMark token={token} /></>}</>}
    <a href="/">timtomaviation.com</a></div></div>);
}
