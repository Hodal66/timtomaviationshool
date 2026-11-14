import { describe, it, expect } from "vitest";
import { db, uniquePhone } from "./db";
import type { Actor } from "@/lib/lecturers";
import { ensureGroup, kigaliDate, saveMarks } from "@/lib/teaching";
import { classify, DEFAULT_RULES, rulesOf, cleanRules, parseDuration, parseClock, parseMeetCsv, setDelivery, importMeetAttendance, correctAttendance, logMeetGap, publishRecording, calendarEvent } from "@/lib/online";
import { studentResources } from "@/lib/resources";

let n = 0; const u = () => `${Date.now().toString(36)}${n++}`;
const acad: Actor = { uid: "", name: "Academic Head", role: "ACADEMIC" };
/** A past date for weekday `dow` (1 = Monday). */
const past = (dow: number) => { const d = new Date(+kigaliDate() - 7 * 864e5); while (((d.getUTCDay() + 6) % 7) + 1 !== dow) d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
async function setup() {
  if (!acad.uid) acad.uid = (await db.user.create({ data: { email: `oa.${u()}@test.local`, name: acad.name, role: "ACADEMIC", passwordHash: "x" } })).id;
  const lec = await db.user.create({ data: { email: `ol.${u()}@test.local`, name: "Online Lecturer", role: "LECTURER", passwordHash: "x" } }); const me: Actor = { uid: lec.id, name: lec.name, role: "LECTURER" };
  const prog = await db.programme.create({ data: { code: "ONL" + u(), name: "Online Prog " + u(), type: "CERTIFICATE", status: "DRAFT" } }); const br = await db.branch.findFirstOrThrow(); const it = await db.intake.findFirstOrThrow();
  const g = await ensureGroup({ programmeId: prog.id, branchId: br.id, intakeId: it.id, session: "WEEKDAY" }); const room = await db.room.create({ data: { name: "R" + u(), branchId: br.id } });
  const slot = await db.timetableSlot.create({ data: { groupId: g.id, roomId: room.id, lecturerId: lec.id, dayOfWeek: 1, startMin: 540, endMin: 660, subject: "Air law" } });
  const mk = (name: string, school?: string) => db.applicant.create({ data: { fullName: name, email: `${name.toLowerCase().replace(/\W/g, "")}.${u()}@gmail.test`, schoolEmail: school ?? null, phone: uniquePhone(), reference: "TAS-O-" + u().toUpperCase(), status: "ENROLLED", programmeId: prog.id, branchId: br.id, intakeId: it.id, classGroupId: g.id } });
  const [ann, bob, cyd, dan, eve] = [await mk("Ann", `ann.${u()}@tas.school`), await mk("Bob"), await mk("Cyd"), await mk("Dan"), await mk("Eve")];
  return { me, prog, g, slot, ann, bob, cyd, dan, eve };
}
describe("online classes (VCL-01..11)", () => {
  it("applies the per-programme rules: 75% present, late after 10 min, left early before the last 15 (VCL-05)", () => {
    const r = DEFAULT_RULES; expect(classify(r, 540, 660, null, null, null).status).toBe("ABSENT"); expect(classify(r, 540, 660, 540, 660, null)).toMatchObject({ status: "PRESENT" });
    expect(classify(r, 540, 660, 555, 660, null)).toMatchObject({ status: "LATE", note: expect.stringMatching(/joined 15 min late/) }); expect(classify(r, 540, 660, 540, 640, null)).toMatchObject({ status: "PRESENT", note: expect.stringMatching(/left 20 min early/) });
    expect(classify(r, 540, 660, 540, 620, null)).toMatchObject({ status: "ABSENT", note: expect.stringMatching(/below the 75%/) }); expect(classify(r, 540, 660, 540, 660, 60).status).toBe("ABSENT");
    expect(classify({ presentPct: 50, lateMin: 30, earlyMin: 15 }, 540, 660, 560, 660, null).status).toBe("PRESENT"); expect(rulesOf(null)).toEqual(DEFAULT_RULES); expect(rulesOf({ presentPct: 500 }).presentPct).toBe(75);
    expect(cleanRules({ presentPct: "0", lateMin: "10", earlyMin: "15" })).toMatch(/1 to 100/); expect(cleanRules({ presentPct: "80", lateMin: "5", earlyMin: "10" })).toEqual({ presentPct: 80, lateMin: 5, earlyMin: 10 });
  });
  it("reads Meet reports in their usual formats and merges rejoins (VCL-04)", () => {
    expect([parseDuration("1 hr 5 min"), parseDuration("45 min"), parseDuration("01:05:00"), parseDuration("90"), parseDuration("")]).toEqual([65, 45, 65, 90, null]); expect([parseClock("9:05 AM"), parseClock("2:30 PM"), parseClock("12:10 AM"), parseClock("2026-11-09 14:30:12"), parseClock("x")]).toEqual([545, 870, 10, 870, null]);
    const r = parseMeetCsv("﻿First name,Last name,Email,Duration,Time joined,Time exited\nAnn,U,ANN@x.org,40 min,9:00 AM,9:40 AM\nAnn,U,ann@x.org,50 min,9:50 AM,10:40 AM\nBad,,nope,5 min,,\n"); expect(r.rows).toEqual([{ email: "ann@x.org", name: "Ann U", join: 540, leave: 640, minutes: 90 }]); expect(r.errors[0]).toMatch(/Row 4/);
    expect(parseMeetCsv("Name,Duration\nAnn,5").errors[0]).toMatch(/Email/); expect(parseMeetCsv("Email,Name\na@b.c,A").errors[0]).toMatch(/Duration/);
  });
  it("delivery: Meet link required and validated; lecturers only for their classes; without Google Workspace there is no silent auto-creation (VCL-01)", async () => {
    const { me, slot } = await setup(); expect(await setDelivery({ ...me, uid: "other" }, slot.id, "ONLINE", "https://meet.google.com/abc-defg-hij")).toMatch(/Not allowed/); expect(await setDelivery(me, slot.id, "ONLINE", "https://zoom.us/j/1")).toMatch(/Google Meet link/);
    expect(await setDelivery(me, slot.id, "ONLINE")).toMatch(/Paste the Google Meet link/); expect(await setDelivery(me, slot.id, "HYBRID", "https://meet.google.com/abc-defg-hij?authuser=0")).toEqual({ meetUrl: "https://meet.google.com/abc-defg-hij", auto: false });
    expect(await setDelivery(me, slot.id, "CAMPUS")).toEqual({ meetUrl: "https://meet.google.com/abc-defg-hij", auto: false }); expect(await setDelivery(me, slot.id, "ONLINE")).toEqual({ meetUrl: "https://meet.google.com/abc-defg-hij", auto: false });
    const ev = calendarEvent({ id: "s1", subject: "Air law", dayOfWeek: 1, startMin: 540, endMin: 660, group: "G1", from: new Date("2026-11-11"), until: new Date("2027-05-11"), guests: ["a@x.org"] });
    expect([ev.start.dateTime, ev.end.dateTime, ev.recurrence[0], ev.conferenceData.createRequest.conferenceSolutionKey.type, ev.attendees]).toEqual(["2026-11-16T09:00:00", "2026-11-16T11:00:00", "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20270511T215959Z", "hangoutsMeet", [{ email: "a@x.org" }]]);
  });
  it("imports the report: school email first, hybrid merge keeps the better campus mark, missing students absent, corrections kept and logged (VCL-04, 06, 07, 10)", async () => {
    const { me, slot, ann, bob, cyd, dan, eve } = await setup(); const d = past(1);
    expect(await importMeetAttendance(me, slot.id, d, "Email,Duration\nx@y.z,10")).toMatch(/on campus/); await setDelivery(me, slot.id, "HYBRID", "https://meet.google.com/abc-defg-hij");
    expect(await importMeetAttendance(me, slot.id, past(2), "Email,Duration\nx@y.z,10")).toMatch(/does not meet on that day/); expect(await importMeetAttendance({ ...me, uid: "x" }, slot.id, d, "")).toMatch(/not your class/);
    await saveMarks(slot.id, d, [{ applicantId: dan.id, status: "PRESENT" }], "QR");
    const csv = `Full name,Email,Time joined,Time exited\nAnn,${ann.schoolEmail},9:02 AM,11:00 AM\nBob,${bob.email},9:20 AM,11:00 AM\nCyd,${cyd.email},9:00 AM,9:30 AM\nDan,${dan.email},9:00 AM,9:20 AM\nStranger,stranger@x.org,9:00 AM,11:00 AM\n`;
    const r = await importMeetAttendance(me, slot.id, d, csv); expect(r).toMatchObject({ present: 1, late: 1, absent: 2, campus: 1, unmatched: ["Stranger <stranger@x.org>"] });
    const sess = await db.classSession.findUniqueOrThrow({ where: { slotId_date: { slotId: slot.id, date: new Date(d) } }, include: { records: true } }); const st = (id: string) => sess.records.find((x) => x.applicantId === id)!;
    expect([st(ann.id).status, st(bob.id).status, st(cyd.id).status, st(dan.id).status, st(eve.id).status]).toEqual(["PRESENT", "LATE", "ABSENT", "PRESENT", "ABSENT"]); expect([st(dan.id).method, st(dan.id).minutes]).toEqual(["QR", null]); expect(st(ann.id).joinAt?.toISOString()).toBe(`${d}T07:02:00.000Z`);
    expect(await db.notification.count({ where: { applicantId: { in: [bob.id, cyd.id, eve.id] }, template: { in: ["online_late", "online_absent"] }, channel: "EMAIL" } })).toBe(3);
    expect(await correctAttendance(me, slot.id, d, cyd.id, "EXCUSED", "no")).toMatch(/reason/); expect(await correctAttendance(me, slot.id, d, cyd.id, "EXCUSED", "Network outage in Musanze, confirmed")).toBeNull(); expect(await correctAttendance(me, slot.id, d, cyd.id, "EXCUSED", "Again the same")).toMatch(/already/);
    await importMeetAttendance(me, slot.id, d, csv); const again = await db.attendance.findFirstOrThrow({ where: { applicantId: cyd.id, sessionId: sess.id } }); expect([again.status, again.method]).toEqual(["EXCUSED", "CORRECTED"]);
    const log = (await db.classSession.findUniqueOrThrow({ where: { id: sess.id } })).log as { action: string }[]; expect(log.map((x) => x.action)).toEqual(["Meet report imported", "Corrected Cyd: ABSENT -> EXCUSED", "Meet report imported"]);
  });
  it("fallback is logged; recordings are view-only and visible only to the class group (VCL-08, VCL-11)", async () => {
    const a = await setup(); const b = await setup(); const d = past(1); expect(await logMeetGap(a.me, a.slot.id, d, "x")).toMatch(/Say why/); expect(await logMeetGap(a.me, a.slot.id, d, "Meet report never arrived")).toBeNull();
    expect(await publishRecording(a.me, a.slot.id, d, "ftp://x")).toMatch(/https/); const r = await publishRecording(a.me, a.slot.id, d, "https://drive.google.com/file/d/abc/view"); expect(typeof r).toBe("object"); expect(await publishRecording(a.me, a.slot.id, d, "https://drive.google.com/x")).toMatch(/already/);
    const res = await db.resource.findUniqueOrThrow({ where: { id: (r as { id: string }).id } }); expect([res.groupId, res.viewOnly, res.status, res.kind]).toEqual([a.g.id, true, "APPROVED", "VIDEO"]);
    expect((await studentResources(a.ann.email!)).map((x) => x.title)).toContain(`Recording: Air law, ${d}`);
    const other = await db.applicant.create({ data: { fullName: "Other Group", email: `og.${u()}@gmail.test`, phone: uniquePhone(), reference: "TAS-O-" + u().toUpperCase(), status: "ENROLLED", programmeId: a.prog.id, branchId: a.ann.branchId, intakeId: a.ann.intakeId, classGroupId: b.g.id } });
    expect((await studentResources(other.email!)).map((x) => x.title)).not.toContain(`Recording: Air law, ${d}`);
    const log = (await db.classSession.findUniqueOrThrow({ where: { slotId_date: { slotId: a.slot.id, date: new Date(d) } } })).log as { action: string }[]; expect(log.map((x) => x.action)).toEqual(["Meet data unavailable: register marked by hand", "Recording published"]);
  });
});
