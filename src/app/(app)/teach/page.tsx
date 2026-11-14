import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { DAYS, hhmm, label } from "@/lib/format";
import { kigaliDate } from "@/lib/teaching";
import { syllabusOf, teachingReport, workload, sessionDates } from "@/lib/lecturers";
import { LessonReports, Availability, Substitute, MyClaims, Announce, type Due, type ClaimRow } from "@/components/TeachPanel";
import { buildClaim, amountFor, type Hist } from "@/lib/claims";
export const dynamic = "force-dynamic";

/** The lecturer's own page: lesson reports, availability, substitute requests, hours and compliance (LEC-06, LEC-13..16). */
export default async function Teach() {
  const me = await getSession(); if (!me || me.role !== "LECTURER") redirect("/dashboard"); const { t } = await getT();
  const today = kigaliDate(); const weekAgo = new Date(+today - 6 * 864e5); const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const [p, w, rep, subs] = await Promise.all([db.lecturerProfile.findUnique({ where: { userId: me.uid } }), workload(me.uid), teachingReport(me.uid, monthStart, today), db.substituteRequest.findMany({ where: { lecturerId: me.uid }, include: { slot: true }, orderBy: { date: "desc" }, take: 8 })]);
  const slots = await db.timetableSlot.findMany({ where: { lecturerId: me.uid }, include: { group: { include: { programme: true } }, lessonReports: { where: { date: { gte: weekAgo, lte: today } } } } });
  const due: Due[] = slots.flatMap((s) => sessionDates(s.dayOfWeek, weekAgo, today).map((d) => ({ key: s.id + d, slotId: s.id, date: d, label: `${t(DAYS[s.dayOfWeek])} ${d} · ${hhmm(s.startMin)} · ${s.subject} · ${s.group.name}`, topics: syllabusOf(s.group.programme.modules), done: s.lessonReports.find((r) => r.date.toISOString().slice(0, 10) === d)?.topic ?? "" }))).sort((a, b) => b.date.localeCompare(a.date));
  const ym = (d: Date) => d.toISOString().slice(0, 7); const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)); const months = [ym(prev), ym(today)];
  const claims = await db.paymentClaim.findMany({ where: { lecturerId: me.uid }, orderBy: { period: "desc" }, take: 12 }); const money = (c: string, n: number) => `${c} ${n.toLocaleString("en-US")}`;
  const preview = Object.fromEntries(await Promise.all(months.map(async (m) => { const b = await buildClaim(me.uid, m); const a = p ? amountFor(p.payModel, p.rate, b.lines) : { amount: 0 };
    return [m, { sessions: b.lines.length, paid: b.lines.filter((l) => l.paid).length, amount: money(p?.currency ?? "RWF", a.amount), missing: b.lines.filter((l) => !l.paid).map((l) => `${l.date} ${l.subject} (${[!l.reported && t("lesson report"), !l.attendance && t("attendance")].filter(Boolean).join(", ")})`) }] as const; })));
  const rows: ClaimRow[] = claims.map((c) => { const h = (c.history as Hist[]).at(-1); return { id: c.id, period: c.period, amount: money(c.currency, c.amount), status: c.status, statusLabel: t(label(c.status)), openQuery: c.openQuery, last: h ? `${h.at.slice(0, 10)} · ${h.action}${h.note ? ": " + h.note : ""}` : "", paid: c.paidRef ? `${t("Reference")}: ${c.paidRef}` : "" }; });
  const next = (dow: number) => { const d = new Date(+today); while (((d.getUTCDay() + 6) % 7) + 1 !== dow) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  return (<><div className="hero"><h1>{t("My teaching")}</h1><p>{t("Report each lesson in under a minute, keep your availability up to date and follow your hours.")}</p></div>
    <div className="kpis"><div className="kpi"><span>{t("Hours a week")}</span><b>{w.hours} / {w.max}</b></div><div className="kpi"><span>{t("Lessons reported this month")}</span><b>{rep.reported} / {rep.sessions}</b></div><div className="kpi"><span>{t("Reports on time")}</span><b>{rep.pct.onTime}%</b></div><div className="kpi"><span>{t("Hours delivered this month")}</span><b>{rep.hours}</b></div><div className="kpi"><span>{t("Syllabus covered")}</span><b>{rep.pct.syllabus === null ? "-" : rep.pct.syllabus + "%"}</b></div></div>
    <LessonReports due={due} />
    <MyClaims claims={rows} months={[...months].reverse()} preview={preview} />
    <div className="grid2" style={{ marginBottom: 16 }}><Availability days={DAYS.map((d) => t(d))} initial={(p?.availability ?? {}) as Record<string, string[]>} />
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}><Announce groups={[...new Map(slots.map((s) => [s.groupId, { id: s.groupId, name: s.group.name }])).values()]} /><Substitute classes={slots.map((s) => ({ slotId: s.id, label: `${t(DAYS[s.dayOfWeek])} ${hhmm(s.startMin)} · ${s.subject} · ${s.group.name}`, next: next(s.dayOfWeek) }))} />
        <div className="panel"><h2>{t("My substitute requests")}</h2>{subs.length === 0 ? <p className="empty">{t("Nothing yet.")}</p> : <ul className="tl">{subs.map((r) => <li key={r.id}>{r.date.toISOString().slice(0, 10)} · {r.slot.subject} <span className={`pill ${r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "bad" : "warn"}`}>{t(label(r.status))}</span>{r.note && <small> · {r.note}</small>}</li>)}</ul>}</div>
        <div className="panel"><h2>{t("My contract")}</h2><p style={{ margin: 0 }}>{t("Pay model")}: <b>{p ? t(label(p.payModel)) : "-"}</b> · {t("Rate")}: <b>{p ? `${p.currency} ${p.rate.toLocaleString("en-US")}` : "-"}</b><br />{t("Contract")}: {p?.contractStart?.toISOString().slice(0, 10) ?? "-"} → {p?.contractEnd?.toISOString().slice(0, 10) ?? "-"}</p></div></div></div></>);
}
