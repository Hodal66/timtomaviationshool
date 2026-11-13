import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { findClash } from "@/lib/clash";
import { DAYS, toMin } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { calToken } from "@/lib/teaching";
import { SITE } from "@/lib/site";
import { TimetableGrid } from "@/components/TimetableGrid";
const EDIT = ["ADMIN", "BRANCH_MANAGER", "ACADEMIC"];
export const dynamic = "force-dynamic";

async function addSlot(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !EDIT.includes(s.role)) throw new Error("Not allowed");
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

async function removeSlot(id: string) {
  "use server";
  const s = await getSession();
  if (!s || !EDIT.includes(s.role)) throw new Error("Not allowed");
  await db.timetableSlot.delete({ where: { id } });
  revalidatePath("/timetable");
}
async function addRoom(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !EDIT.includes(s.role)) throw new Error("Not allowed");
  const g = await db.classGroup.findUnique({ where: { id: String(fd.get("groupId")) } }); const name = String(fd.get("name") ?? "").trim().slice(0, 60), capacity = Math.max(1, Math.min(500, Number(fd.get("capacity")) || 30));
  if (!g || !name) return;
  await db.room.upsert({ where: { branchId_name: { branchId: g.branchId, name } }, update: { capacity }, create: { branchId: g.branchId, name, capacity } });
  revalidatePath("/timetable"); redirect(`/timetable?g=${g.id}`);
}
/** TTB-02: move a class to another day or time. The length is kept; clashes for lecturer, room or group are refused. */
async function moveSlot(id: string, day: number, startMin: number): Promise<string | null> {
  "use server";
  const s = await getSession();
  if (!s || !EDIT.includes(s.role)) throw new Error("Not allowed");
  const x = await db.timetableSlot.findUnique({ where: { id }, include: { group: true } }); if (!x) return "That class no longer exists.";
  const allowed = x.group.session === "WEEKEND" ? [6, 7] : [1, 2, 3, 4, 5];
  if (!allowed.includes(day) || !Number.isInteger(startMin) || startMin < 6 * 60 || startMin > 21 * 60) return "Choose a day and time inside the teaching week.";
  const endMin = startMin + (x.endMin - x.startMin);
  const clash = await findClash({ groupId: x.groupId, roomId: x.roomId, lecturerId: x.lecturerId, dayOfWeek: day, startMin, endMin, ignoreId: id }); if (clash) return clash;
  await db.timetableSlot.update({ where: { id }, data: { dayOfWeek: day, startMin, endMin } }); revalidatePath("/timetable"); return null;
}

export default async function Timetable({ searchParams }: { searchParams: Promise<{ g?: string; e?: string }> }) {
  const { g, e } = await searchParams; const me = await getSession(); if (!me) redirect("/login"); const { t } = await getT(); const canEdit = EDIT.includes(me.role);
  const groups = await db.classGroup.findMany({ where: me.role === "LECTURER" ? { slots: { some: { lecturerId: me.uid } } } : {}, orderBy: { name: "asc" }, include: { _count: { select: { students: true, slots: true } } } });
  const group = groups.find((x) => x.id === g) ?? groups[0];
  if (!group) return <div className="panel empty">{t("No class groups yet. A group is created automatically when the first student is enrolled.")}</div>;
  const days = group.session === "WEEKEND" ? [6, 7] : [1, 2, 3, 4, 5];
  const [slots, rooms, lecturers] = await Promise.all([
    db.timetableSlot.findMany({ where: { groupId: group.id }, include: { room: true, lecturer: true }, orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }] }),
    db.room.findMany({ where: { branchId: group.branchId }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: "LECTURER" }, orderBy: { name: "asc" } }),
  ]);
  const feed = `${SITE.url}/api/calendar/${calToken("g", group.id)}.ics`; const mine = me.role === "LECTURER" ? `${SITE.url}/api/calendar/${calToken("l", me.uid)}.ics` : null;
  return (<><div className="top"><div><h1>{t("Timetable")}</h1><p>{t("Drag a class to another day or hour. Clashes for lecturer, room and group are refused.")}</p></div></div>
    <form className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
      <label htmlFor="g"><b>{t("Class group")}</b></label>
      <select id="g" name="g" defaultValue={group.id}>{groups.map((x) => <option key={x.id} value={x.id}>{x.name} ({x._count.students})</option>)}</select>
      <button type="submit">{t("Show")}</button><span className="pill">{group._count.students} {t("students")}</span><span className="pill">{slots.length} {t("classes a week")}</span>
      <a href={feed}>{t("Calendar link for this group")}</a>{mine && <a href={mine}>{t("My teaching calendar")}</a>}</form>
    <div className="panel" style={{ marginBottom: 16 }}>{slots.length === 0 ? <p className="empty">{t("No classes yet for this group.")}</p> : <TimetableGrid slots={slots.map((x) => ({ id: x.id, subject: x.subject, dayOfWeek: x.dayOfWeek, startMin: x.startMin, endMin: x.endMin, lecturer: x.lecturer.name, room: x.room.name }))} days={days} dayNames={DAYS} canEdit={canEdit} move={moveSlot} remove={removeSlot} />}</div>
    {canEdit && <form action={addSlot} className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <b style={{ width: "100%" }}>{t("Add a class")}: {group.name}</b>
      <input type="hidden" name="groupId" value={group.id} />
      <input name="subject" placeholder={t("Subject")} aria-label={t("Subject")} required />
      <select name="dayOfWeek" aria-label={t("Day")}>{days.map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</select>
      <input name="start" type="time" defaultValue="08:00" aria-label={t("Start")} required /><input name="end" type="time" defaultValue="10:00" aria-label={t("End")} required />
      <select name="lecturerId" aria-label={t("Lecturer")}>{lecturers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <select name="roomId" aria-label={t("Room")}>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <button className="p" type="submit">{t("Add class")}</button>
      {rooms.length === 0 && <span className="err" style={{ width: "100%" }}>{t("This branch has no rooms yet. Add one below first.")}</span>}
      {e && <span className="err" role="alert" style={{ width: "100%" }}>{e}</span>}
    </form>}
    {canEdit && <form action={addRoom} className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16, alignItems: "center" }}><b>{t("Rooms at this branch")}:</b>{rooms.map((r) => <span key={r.id} className="pill">{r.name} ({r.capacity})</span>)}
      <input type="hidden" name="groupId" value={group.id} /><input name="name" placeholder={t("New room name")} aria-label={t("New room name")} required /><input name="capacity" type="number" min={1} max={500} defaultValue={30} aria-label={t("Seats")} style={{ width: 90 }} /><button type="submit">{t("Add room")}</button></form>}</>);
}
