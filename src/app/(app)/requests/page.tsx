import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { getT } from "@/lib/i18n/server";
import { decideRequest } from "@/lib/student";
import { LETTER_TYPES } from "@/lib/docs";
import { label } from "@/lib/format";
export const dynamic = "force-dynamic";

async function decide(approve: boolean, fd: FormData) {
  "use server";
  const s = await getSession(); if (!s || !can.admissions(s.role)) throw new Error("Not allowed");
  const err = await decideRequest(String(fd.get("id")), approve, s.name, String(fd.get("note") ?? ""));
  revalidatePath("/requests"); redirect("/requests" + (err ? "?e=" + encodeURIComponent(err) : "?ok=1"));
}
/** STU-03, STU-06: student requests that need a decision. */
export default async function Requests({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string; all?: string }> }) {
  const me = await getSession(); if (!me || !can.admissions(me.role)) redirect("/dashboard");
  const { t } = await getT(); const sp = await searchParams; const branches = await db.branch.findMany();
  const rows = await db.studentRequest.findMany({ where: sp.all ? {} : { status: "PENDING" }, include: { applicant: { include: { programme: true, branch: true } } }, orderBy: { createdAt: sp.all ? "desc" : "asc" }, take: 200 });
  const what = (r: (typeof rows)[number]) => { const d = r.detail as Record<string, string>; if (r.type === "LETTER") return `${LETTER_TYPES[d.letter as keyof typeof LETTER_TYPES] ?? "Letter"}, addressed to: ${d.addressedTo}`;
    if (r.type === "SESSION_CHANGE") return [d.session && `schedule ${r.applicant.session.toLowerCase()} → ${d.session.toLowerCase()}`, d.branchId && `branch ${r.applicant.branch.name} → ${branches.find((b) => b.id === d.branchId)?.name}`].filter(Boolean).join("; ");
    return [d.fullName && `name "${r.applicant.fullName}" → "${d.fullName}"`, d.dob && `date of birth ${r.applicant.dateOfBirth?.toISOString().slice(0, 10) ?? "-"} → ${d.dob}`].filter(Boolean).join("; "); };
  return (<><div className="top"><div><h1>{t("Student requests")}</h1><p>{t("Profile changes, schedule or branch changes and official letters. Approving applies the change or releases the letter to the student.")}</p></div>
      <a href={sp.all ? "/requests" : "/requests?all=1"}>{sp.all ? t("Show waiting only") : t("Show all")}</a></div>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="ok" role="status">{t("Saved.")}</p>}
    {rows.length === 0 && <div className="panel empty">{t("No requests are waiting.")}</div>}
    <div style={{ display: "grid", gap: 12 }}>{rows.map((r) => <div className="panel" key={r.id} data-request={r.id}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><b>{label(r.type)}</b> · <a href={`/admissions/${r.applicantId}`}>{r.applicant.fullName}</a> <small style={{ color: "var(--muted)" }}>{r.applicant.reference} · {r.applicant.programme.name}</small></div><span className={`pill ${r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "bad" : "warn"}`}>{label(r.status)}</span></div>
      <p style={{ margin: "8px 0 4px" }}>{what(r)}</p>{r.reason && <p style={{ margin: 0, color: "var(--muted)" }}>{t("Reason")}: {r.reason}</p>}
      {r.status === "PENDING" ? <form style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}><input type="hidden" name="id" value={r.id} /><input name="note" placeholder={t("Note to the student (needed to refuse)")} aria-label={t("Note to the student")} style={{ flex: 1, minWidth: 220 }} /><button className="p" formAction={decide.bind(null, true)}>{t("Approve")}</button><button className="danger" formAction={decide.bind(null, false)}>{t("Refuse")}</button></form>
        : <small style={{ color: "var(--muted)" }}>{r.decidedBy} · {r.decidedAt?.toISOString().slice(0, 10)}{r.note ? ` · ${r.note}` : ""}</small>}</div>)}</div></>);
}
