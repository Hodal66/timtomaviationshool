import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { DAYS, dateForDow, hhmm, label } from "@/lib/format";
import type { AttendanceStatus } from "@prisma/client";
export const dynamic = "force-dynamic";
const STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];

async function save(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !["ADMIN", "LECTURER", "BRANCH_MANAGER"].includes(s.role)) throw new Error("Not allowed");
  const slotId = String(fd.get("slotId"));
  const date = new Date(String(fd.get("date")) + "T00:00:00Z");
  const session = await db.classSession.upsert({ where: { slotId_date: { slotId, date } }, update: {}, create: { slotId, date } });
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("st_")) continue;
    const applicantId = k.slice(3), status = String(v) as AttendanceStatus;
    if (!STATUSES.includes(status)) continue;
    await db.attendance.upsert({ where: { applicantId_sessionId: { applicantId, sessionId: session.id } }, update: { status }, create: { applicantId, sessionId: session.id, status } });
  }
  revalidatePath("/attendance");
  redirect(`/attendance?slot=${slotId}&saved=1`);
}

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ slot?: string; saved?: string }> }) {
  const { slot: slotId, saved } = await searchParams;
  const slots = await db.timetableSlot.findMany({ include: { group: true, lecturer: true }, orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }] });
  const slot = slots.find((x) => x.id === slotId) ?? slots[0];
  if (!slot) return <p>Add a class to the timetable first.</p>;
  const date = dateForDow(slot.dayOfWeek);
  const dateStr = date.toISOString().slice(0, 10);
  const students = await db.applicant.findMany({ where: { classGroupId: slot.groupId, status: "ENROLLED" }, orderBy: { fullName: "asc" } });
  const existing = await db.attendance.findMany({ where: { session: { slotId: slot.id, date } } });
  const current = new Map(existing.map((r) => [r.applicantId, r.status]));

  // Attendance rate per student over all recorded sessions of this group.
  const all = await db.attendance.findMany({ where: { session: { slot: { groupId: slot.groupId } }, applicantId: { in: students.map((s) => s.id) } } });
  const rate = new Map<string, number>();
  for (const st of students) {
    const mine = all.filter((r) => r.applicantId === st.id);
    if (mine.length) rate.set(st.id, Math.round((mine.filter((r) => r.status === "PRESENT" || r.status === "LATE" || r.status === "EXCUSED").length / mine.length) * 100));
  }
  return (<><div className="top"><h1>Attendance</h1><p>Roll call per class. Students under 80% are flagged.</p></div>
    <form className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      <label htmlFor="slot"><b>Class</b></label>
      <select id="slot" name="slot" defaultValue={slot.id}>{slots.map((x) => <option key={x.id} value={x.id}>{x.group.name} · {DAYS[x.dayOfWeek]} {hhmm(x.startMin)} · {x.subject}</option>)}</select>
      <button type="submit">Open</button>
    </form>
    <form action={save} className="panel">
      <input type="hidden" name="slotId" value={slot.id} /><input type="hidden" name="date" value={dateStr} />
      <h2>{slot.subject} · {slot.group.name} · {dateStr}</h2>
      <div className="tbl"><table><thead><tr><th>Student</th><th>Status</th><th>Attendance</th></tr></thead><tbody>
        {students.length === 0 && <tr><td colSpan={3}>No enrolled students in this group yet.</td></tr>}
        {students.map((st) => { const r = rate.get(st.id); return (<tr key={st.id}><td>{st.fullName}</td>
          <td><select name={`st_${st.id}`} aria-label={`Status for ${st.fullName}`} defaultValue={current.get(st.id) ?? "PRESENT"}>{STATUSES.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></td>
          <td>{r === undefined ? "No records" : <span className={`pill ${r < 80 ? "bad" : "ok"}`}>{r}%</span>}</td></tr>); })}
      </tbody></table></div>
      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button className="p" type="submit">Save attendance</button>{saved && <span className="pill ok" role="status">Saved</span>}
      </div>
    </form></>);
}
