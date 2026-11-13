import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { label } from "@/lib/format";
import { actOnClaim, claimsSummary, type Clearance, type Hist, type Line } from "@/lib/claims";
export const dynamic = "force-dynamic";
const STAFF = ["ADMIN", "ACADEMIC", "BRANCH_MANAGER", "FINANCE"];
const NEXT: Record<string, { act: "coordinator" | "academic" | "finance"; label: string; roles: string[] }> = {
  SUBMITTED: { act: "coordinator", label: "Approve as coordinator", roles: ["ADMIN", "ACADEMIC", "BRANCH_MANAGER"] },
  COORDINATOR_APPROVED: { act: "academic", label: "Approve as Head of Academics", roles: ["ADMIN", "ACADEMIC"] },
  ACADEMIC_APPROVED: { act: "finance", label: "Mark as paid", roles: ["ADMIN", "FINANCE"] },
};
async function act(kind: string, fd: FormData) {
  "use server";
  const s = await getSession(); if (!s || !STAFF.includes(s.role)) throw new Error("Not allowed");
  const err = await actOnClaim({ uid: s.uid, name: s.name, role: s.role }, String(fd.get("id")), kind as never, String(fd.get("note") ?? ""), String(fd.get("ref") ?? ""));
  revalidatePath("/claims"); const back = String(fd.get("back") ?? ""); redirect("/claims?" + (back ? back + "&" : "") + (err ? "e=" + encodeURIComponent(err) : "ok=1"));
}
const pill = (s: string) => s === "PAID" ? "ok" : s === "RETURNED" ? "bad" : "warn";
const money = (c: string, n: number) => `${c} ${n.toLocaleString("en-US")}`;

/** LEC-18..22, LEC-25: lecturer payment claims, clearance and the approval chain. */
export default async function Claims({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string; status?: string; period?: string }> }) {
  const me = await getSession(); if (!me || !STAFF.includes(me.role)) redirect("/dashboard"); const { t } = await getT(); const sp = await searchParams;
  const status = sp.status ?? "OPEN"; const period = /^\d{4}-\d{2}$/.test(sp.period ?? "") ? sp.period : undefined;
  const where = { ...(period ? { period } : {}), ...(status === "OPEN" ? { status: { in: ["SUBMITTED", "COORDINATOR_APPROVED", "ACADEMIC_APPROVED"] } } : status === "ALL" ? {} : { status }) };
  const [rows, sum] = await Promise.all([db.paymentClaim.findMany({ where, include: { lecturer: { select: { name: true, email: true } } }, orderBy: [{ openQuery: "desc" }, { updatedAt: "asc" }], take: 200 }), claimsSummary(period)]);
  const back = new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), ...(period ? { period } : {}) }).toString();
  const k = (s: string) => sum[s] ?? { n: 0, RWF: 0, USD: 0 };
  return (<><div className="top"><div><h1>{t("Lecturer pay claims")}</h1><p>{t("Monthly claims built from delivered sessions. Each session needs a lesson report and an attendance register. Approval: coordinator, then Head of Academics, then Finance pays.")}</p></div>
      <a className="btn" href={`/api/claims/export${period ? "?period=" + period : ""}`} download>{t("Download CSV")}</a></div>
    <div className="kpis">{["SUBMITTED", "COORDINATOR_APPROVED", "ACADEMIC_APPROVED", "PAID", "RETURNED"].map((s) => <div className="kpi" key={s} data-kpi={s}><span>{t(label(s))}</span><b>{k(s).n}</b><small>{money("RWF", k(s).RWF)}{k(s).USD ? ` · ${money("USD", k(s).USD)}` : ""}</small></div>)}</div>
    <form className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}><label>{t("Status")}<br /><select name="status" defaultValue={status}><option value="OPEN">{t("Waiting for a decision")}</option><option value="ALL">{t("All")}</option>{["SUBMITTED", "COORDINATOR_APPROVED", "ACADEMIC_APPROVED", "PAID", "RETURNED"].map((s) => <option key={s} value={s}>{t(label(s))}</option>)}</select></label>
      <label>{t("Month")}<br /><input type="month" name="period" defaultValue={period} /></label><button type="submit">{t("Filter")}</button></form>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="ok" role="status">{t("Saved.")}</p>}
    {rows.length === 0 && <div className="panel empty">{t("No claims match.")}</div>}
    <div style={{ display: "grid", gap: 12 }}>{rows.map((c) => { const cl = c.clearance as Clearance, lines = c.lines as Line[], hist = c.history as Hist[], nx = NEXT[c.status];
      return (<div className="panel" key={c.id} data-claim={c.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><b><a href={`/lecturers/${c.lecturerId}`}>{c.lecturer.name}</a></b> · {c.period} · <b>{money(c.currency, c.amount)}</b> <small style={{ color: "var(--muted)" }}>{c.units} × {money(c.currency, c.rate)} ({t(label(c.payModel))})</small></div>
          <span>{c.openQuery && <span className="pill bad" style={{ marginRight: 6 }}>{t("Open query")}</span>}<span className={`pill ${pill(c.status)}`}>{t(label(c.status))}</span></span></div>
        <ul aria-label={t("Clearance")} style={{ display: "flex", gap: 8, flexWrap: "wrap", listStyle: "none", padding: 0, margin: "8px 0" }}>
          <li className={`pill ${cl.reports ? "ok" : "bad"}`}>{t("Lesson reports")}: {cl.reports ? t("complete") : t("{n} missing", { n: cl.missingReports })}</li>
          <li className={`pill ${cl.attendance ? "ok" : "bad"}`}>{t("Attendance registers")}: {cl.attendance ? t("complete") : t("{n} missing", { n: cl.missingAttendance })}</li>
          <li className={`pill ${cl.grades ? "ok" : "bad"}`}>{t("Marks")}: {cl.grades ? t("submitted") : t("{n} late", { n: cl.lateGrades })}</li></ul>
        <details><summary>{t("{n} sessions", { n: lines.length })}</summary><div className="tablewrap" tabIndex={0} role="region" aria-label={t("Sessions")}><table><thead><tr><th>{t("Date")}</th><th>{t("Subject")}</th><th>{t("Class")}</th><th>{t("Hours")}</th><th>{t("Lesson report")}</th><th>{t("Attendance")}</th><th>{t("Paid")}</th></tr></thead>
          <tbody>{lines.map((l) => <tr key={l.slotId + l.date}><td>{l.date}</td><td>{l.subject}</td><td>{l.group}</td><td>{l.hours}</td><td>{l.reported ? "✓" : "✗"}</td><td>{l.attendance ? "✓" : "✗"}</td><td>{l.paid ? t("Yes") : t("No")}</td></tr>)}</tbody></table></div></details>
        <details><summary>{t("History")}</summary><ul className="tl">{hist.map((h, i) => <li key={i}>{h.at.slice(0, 16).replace("T", " ")} · {h.by} · <b>{h.action}</b>{h.note ? ` · ${h.note}` : ""}</li>)}</ul></details>
        {c.status === "PAID" ? <small style={{ color: "var(--muted)" }}>{t("Paid")} {c.paidAt?.toISOString().slice(0, 10)} · {t("Reference")}: {c.paidRef}</small>
          : c.status !== "RETURNED" && <form style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value={back} />
            <input name="note" placeholder={t("Comment (needed to return or answer)")} aria-label={t("Comment")} style={{ flex: 1, minWidth: 200 }} />
            {nx?.act === "finance" && nx.roles.includes(me.role) && <input name="ref" placeholder={t("Transfer reference")} aria-label={t("Transfer reference")} />}
            {nx && nx.roles.includes(me.role) && <button className="p" formAction={act.bind(null, nx.act)}>{t(nx.label)}</button>}
            {c.openQuery && <button formAction={act.bind(null, "answer")}>{t("Answer query")}</button>}
            <button className="danger" formAction={act.bind(null, "return")}>{t("Return to lecturer")}</button></form>}
      </div>); })}</div></>);
}
