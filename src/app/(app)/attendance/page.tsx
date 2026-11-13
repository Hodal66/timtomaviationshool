import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { DAYS, hhmm } from "@/lib/format";
import { rateOf, kigaliDow, kigaliDate, THRESHOLD } from "@/lib/teaching";
import { RollCall, type RollStudent } from "@/components/RollCall";
export const dynamic = "force-dynamic";

/** Lecturers see their own classes; administrators and branch managers see all. */
export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ slot?: string; date?: string }> }) {
  const s = await getSession(); if (!s || !["ADMIN", "LECTURER", "BRANCH_MANAGER"].includes(s.role)) redirect("/dashboard");
  const { t } = await getT(); const { slot: slotId, date: dateParam } = await searchParams; const today = kigaliDow();
  const slots = await db.timetableSlot.findMany({ where: s.role === "LECTURER" ? { lecturerId: s.uid } : {}, include: { group: true, lecturer: true }, orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }] });
  const slot = slots.find((x) => x.id === slotId) ?? slots.find((x) => x.dayOfWeek === today) ?? slots[0];
  if (!slot) return <div className="panel empty">{t("No classes in the timetable yet.")}</div>;
  // The session being marked: the chosen date, else today when the class runs today, else the most recent day it ran.
  const todayDate = kigaliDate(); const recent = new Date(+todayDate - ((today - slot.dayOfWeek + 7) % 7) * 864e5);
  const picked = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(dateParam + "T00:00:00Z") : null;
  const date = picked && +picked <= +todayDate && ((picked.getUTCDay() + 6) % 7) + 1 === slot.dayOfWeek ? picked : recent; const dateStr = date.toISOString().slice(0, 10); const isToday = +date === +todayDate;
  const students = await db.applicant.findMany({ where: { classGroupId: slot.groupId, status: "ENROLLED" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, attendance: { where: { session: { slot: { groupId: slot.groupId } } }, select: { status: true, method: true, session: { select: { slotId: true, date: true } } } } } });
  const roll: RollStudent[] = students.map((st) => { const now = st.attendance.find((r) => r.session.slotId === slot.id && +r.session.date === +date); return { id: st.id, name: st.fullName, status: (now?.status as RollStudent["status"]) ?? null, method: now?.method ?? null, rate: rateOf(st.attendance.map((r) => r.status)) }; });
  const low = roll.filter((r) => r.rate !== null && r.rate < THRESHOLD).length;
  return (<><div className="top"><div><h1>{t("Attendance")}</h1><p>{t("Take the roll, or show the QR code and let students check in. Marks are kept on your phone if the connection drops.")}</p></div></div>
    <form className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}><label htmlFor="slot"><b>{t("Class")}</b></label>
      <select id="slot" name="slot" defaultValue={slot.id}>{slots.map((x) => <option key={x.id} value={x.id}>{x.group.name} · {DAYS[x.dayOfWeek]} {hhmm(x.startMin)} · {x.subject}</option>)}</select><input type="date" name="date" defaultValue={dateStr} max={todayDate.toISOString().slice(0, 10)} aria-label={t("Date")} /><button type="submit">{t("Open")}</button>
      {low > 0 && <span className="pill bad" style={{ alignSelf: "center" }}>{low} {t("below")} {THRESHOLD}%</span>}</form>
    <RollCall key={slot.id + dateStr} live={isToday} slotId={slot.id} date={dateStr} students={roll} title={`${slot.subject} · ${slot.group.name} · ${dateStr}`} /></>);
}
