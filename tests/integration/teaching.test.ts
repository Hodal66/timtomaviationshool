import { describe, it, expect } from "vitest";
import { db, uniquePhone } from "./db";
import { ensureGroup, saveMarks, alertLowAttendance } from "@/lib/teaching";
import { advanceApplicant } from "@/lib/admissions";
import { findClash } from "@/lib/clash";

let n = 0; const u = () => `${Date.now().toString(36)}${n++}`;
async function world() {
  const prog = await db.programme.create({ data: { code: "TCH" + u(), name: "Teaching Test " + u(), type: "CERTIFICATE", status: "DRAFT" } }); const br = await db.branch.findFirstOrThrow(); const it = await db.intake.findFirstOrThrow();
  const mk = (name: string, status = "ADMITTED") => db.applicant.create({ data: { fullName: name, email: `t${u()}@example.com`, phone: uniquePhone(), reference: "TAS-T-" + u().toUpperCase(), status: status as never, programmeId: prog.id, branchId: br.id, intakeId: it.id } });
  const lect = await db.user.create({ data: { email: `lec${u()}@test.local`, name: "Lect " + u(), role: "LECTURER", passwordHash: "x" } }); const room = await db.room.create({ data: { name: "Room " + u(), branchId: br.id } });
  return { prog, br, it, mk, lect, room };
}
describe("teaching with the database", () => {
  it("enrolling places the student in the class group for programme, branch, intake and session, creating it once (TTB-01)", async () => {
    const w = await world(); const a = await w.mk("Enrol One"), b = await w.mk("Enrol Two"); expect(await advanceApplicant(a.id, "QA")).toBeNull(); expect(await advanceApplicant(b.id, "QA")).toBeNull();
    const [x, y] = await Promise.all([db.applicant.findUniqueOrThrow({ where: { id: a.id } }), db.applicant.findUniqueOrThrow({ where: { id: b.id } })]); expect(x.status).toBe("ENROLLED"); expect(x.classGroupId).not.toBeNull(); expect(y.classGroupId).toBe(x.classGroupId);
    expect(await db.classGroup.count({ where: { programmeId: w.prog.id } })).toBe(1); const g = await db.classGroup.findUniqueOrThrow({ where: { id: x.classGroupId! } }); expect(g.name).toContain(w.prog.code); expect(g.name).toMatch(/ WD$/);
    const we = await ensureGroup({ programmeId: w.prog.id, branchId: w.br.id, intakeId: w.it.id, session: "WEEKEND" }); expect(we.id).not.toBe(g.id); expect((await ensureGroup({ programmeId: w.prog.id, branchId: w.br.id, intakeId: w.it.id, session: "WEEKEND" })).id).toBe(we.id);
  });
  it("moving a class is refused on a lecturer, room or group clash, and ignores the class itself (TTB-02)", async () => {
    const w = await world(); const g1 = await ensureGroup({ programmeId: w.prog.id, branchId: w.br.id, intakeId: w.it.id, session: "WEEKDAY" }); const g2 = await ensureGroup({ programmeId: w.prog.id, branchId: w.br.id, intakeId: w.it.id, session: "WEEKEND" }); const room2 = await db.room.create({ data: { name: "Room " + u(), branchId: w.br.id } });
    const s1 = await db.timetableSlot.create({ data: { groupId: g1.id, roomId: w.room.id, lecturerId: w.lect.id, dayOfWeek: 1, startMin: 480, endMin: 600, subject: "A" } });
    const base = { groupId: g2.id, roomId: room2.id, lecturerId: w.lect.id, dayOfWeek: 1, startMin: 540, endMin: 660 }; expect(await findClash(base)).toMatch(/already teaches/);
    const other = await db.user.create({ data: { email: `lec${u()}@test.local`, name: "Other", role: "LECTURER", passwordHash: "x" } }); expect(await findClash({ ...base, lecturerId: other.id, roomId: w.room.id })).toMatch(/already booked/); expect(await findClash({ ...base, lecturerId: other.id, groupId: g1.id })).toMatch(/already has a class/);
    expect(await findClash({ ...base, lecturerId: other.id })).toBeNull(); expect(await findClash({ ...base, startMin: 600, endMin: 720 })).toBeNull(); expect(await findClash({ groupId: g1.id, roomId: w.room.id, lecturerId: w.lect.id, dayOfWeek: 1, startMin: 500, endMin: 620, ignoreId: s1.id })).toBeNull();
  });
  it("marks are saved once per student and session, repeat safely (offline sync), and ignore students outside the group (ATT-01, ATT-02)", async () => {
    const w = await world(); const a = await w.mk("Roll A"), b = await w.mk("Roll B"), out = await w.mk("Outsider", "SUBMITTED"); await advanceApplicant(a.id, "QA"); await advanceApplicant(b.id, "QA"); const gid = (await db.applicant.findUniqueOrThrow({ where: { id: a.id } })).classGroupId!;
    const slot = await db.timetableSlot.create({ data: { groupId: gid, roomId: w.room.id, lecturerId: w.lect.id, dayOfWeek: 2, startMin: 480, endMin: 600, subject: "Roll" } }); const marks = [{ applicantId: a.id, status: "PRESENT" }, { applicantId: b.id, status: "ABSENT" }, { applicantId: out.id, status: "PRESENT" }, { applicantId: a.id, status: "NONSENSE" }];
    const r1 = await saveMarks(slot.id, "2027-01-12", marks, "ROLL"); expect("saved" in r1 && r1.saved).toBe(2); const r2 = await saveMarks(slot.id, "2027-01-12", [{ applicantId: b.id, status: "LATE" }], "OFFLINE"); expect("saved" in r2 && r2.saved).toBe(1);
    const rec = await db.attendance.findMany({ where: { session: { slotId: slot.id } }, orderBy: { applicant: { fullName: "asc" } } }); expect(rec.map((x) => [x.status, x.method])).toEqual([["PRESENT", "ROLL"], ["LATE", "OFFLINE"]]); expect(await db.classSession.count({ where: { slotId: slot.id } })).toBe(1);
    expect(await saveMarks(slot.id, "12/01/2027", marks, "ROLL")).toEqual({ error: "Bad date." }); expect(await saveMarks("nope", "2027-01-12", marks, "ROLL")).toEqual({ error: "Class not found." });
  });
  it("alerts a student under 80% after 3 sessions, once a week, and not students at or above 80% (ATT-03)", async () => {
    const w = await world(); const low = await w.mk("Low Att"), ok = await w.mk("Good Att"); await advanceApplicant(low.id, "QA"); await advanceApplicant(ok.id, "QA"); const gid = (await db.applicant.findUniqueOrThrow({ where: { id: low.id } })).classGroupId!;
    const slot = await db.timetableSlot.create({ data: { groupId: gid, roomId: w.room.id, lecturerId: w.lect.id, dayOfWeek: 3, startMin: 480, endMin: 600, subject: "Alert" } });
    for (const [d, l] of [["2027-01-13", "ABSENT"], ["2027-01-20", "ABSENT"]] as const) await saveMarks(slot.id, d, [{ applicantId: low.id, status: l }, { applicantId: ok.id, status: "PRESENT" }], "ROLL");
    expect((await db.applicant.findUniqueOrThrow({ where: { id: low.id } })).attendanceAlertAt, "no alert before 3 sessions").toBeNull();
    await saveMarks(slot.id, "2027-01-27", [{ applicantId: low.id, status: "PRESENT" }, { applicantId: ok.id, status: "PRESENT" }], "ROLL");
    const after = await db.applicant.findUniqueOrThrow({ where: { id: low.id } }); expect(after.attendanceAlertAt).not.toBeNull(); expect((await db.applicant.findUniqueOrThrow({ where: { id: ok.id } })).attendanceAlertAt).toBeNull();
    expect(await db.notification.count({ where: { applicantId: low.id, template: "attendance_low" } })).toBeGreaterThanOrEqual(1); expect(await alertLowAttendance(gid)).toEqual([]); expect(await alertLowAttendance(gid, new Date(Date.now() + 8 * 864e5))).toEqual([low.id]);
  });
});
