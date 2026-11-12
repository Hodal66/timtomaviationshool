import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { findClash } from "@/lib/clash";
import { DAYS, hhmm, toMin } from "@/lib/format";
export const dynamic = "force-dynamic";

async function addSlot(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !["ADMIN", "BRANCH_MANAGER"].includes(s.role)) throw new Error("Not allowed");
  const groupId = String(fd.get("groupId"));
  const p = { groupId, roomId: String(fd.get("roomId")), lecturerId: String(fd.get("lecturerId")),
    dayOfWeek: Number(fd.get("dayOfWeek")), startMin: toMin(String(fd.get("start"))), endMin: toMin(String(fd.get("end"))) };
  const subject = String(fd.get("subject") ?? "").trim();
  if (!subject || p.endMin <= p.startMin) redirect(`/timetable?g=${groupId}&e=${encodeURIComponent("Enter a subject and an end time after the start time.")}`);
  const clash = await findClash(p);
  if (clash) redirect(`/timetable?g=${groupId}&e=${encodeURIComponent(clash)}`);
  await db.timetableSlot.create({ data: { ...p, subject } });
  revalidatePath("/timetable");
  redirect(`/timetable?g=${groupId}`);
}

async function removeSlot(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !["ADMIN", "BRANCH_MANAGER"].includes(s.role)) throw new Error("Not allowed");
  await db.timetableSlot.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/timetable");
}

export default async function Timetable({ searchParams }: { searchParams: Promise<{ g?: string; e?: string }> }) {
  const { g, e } = await searchParams;
  const groups = await db.classGroup.findMany({ orderBy: { name: "asc" } });
  const group = groups.find((x) => x.id === g) ?? groups[0];
  if (!group) return <p>No class groups yet.</p>;
  const [slots, rooms, lecturers] = await Promise.all([
    db.timetableSlot.findMany({ where: { groupId: group.id }, include: { room: true, lecturer: true }, orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }] }),
    db.room.findMany({ where: { branchId: group.branchId }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: "LECTURER" }, orderBy: { name: "asc" } }),
  ]);
  return (<><div className="top"><h1>Timetable</h1><p>Clashes for lecturer, room and group are blocked when you add a class.</p></div>
    <form className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      <label htmlFor="g"><b>Class group</b></label>
      <select id="g" name="g" defaultValue={group.id}>{groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <button type="submit">Show</button>
    </form>
    <div className="panel tbl" style={{ marginBottom: 16 }}><table><thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Lecturer</th><th>Room</th><th></th></tr></thead><tbody>
      {slots.length === 0 && <tr><td colSpan={6}>No classes yet for {group.name}.</td></tr>}
      {slots.map((x) => <tr key={x.id}><td>{DAYS[x.dayOfWeek]}</td><td>{hhmm(x.startMin)}–{hhmm(x.endMin)}</td><td>{x.subject}</td><td>{x.lecturer.name}</td><td>{x.room.name}</td>
        <td><form action={removeSlot}><input type="hidden" name="id" value={x.id} /><button className="s" type="submit">Remove</button></form></td></tr>)}
    </tbody></table></div>
    <form action={addSlot} className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <b style={{ width: "100%" }}>Add a class to {group.name}</b>
      <input type="hidden" name="groupId" value={group.id} />
      <input name="subject" placeholder="Subject" aria-label="Subject" required />
      <select name="dayOfWeek" aria-label="Day">{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</select>
      <input name="start" type="time" defaultValue="08:00" aria-label="Start" required /><input name="end" type="time" defaultValue="10:00" aria-label="End" required />
      <select name="lecturerId" aria-label="Lecturer">{lecturers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <select name="roomId" aria-label="Room">{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <button className="p" type="submit">Add class</button>
      {e && <span className="err" role="alert" style={{ width: "100%" }}>{e}</span>}
    </form></>);
}
