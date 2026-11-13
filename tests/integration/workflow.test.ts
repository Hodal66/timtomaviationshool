import { beforeAll, describe, expect, it } from "vitest";
import { db, uniquePhone } from "./db";
import { createApplication } from "@/lib/application";
import { advanceApplicant } from "@/lib/admissions";
import { ensureIntake, upcomingIntakes } from "@/lib/intakes";
import { findClash } from "@/lib/clash";
import { getCatalogue, featured } from "@/lib/catalogue-data";
import { notifyApplicant, alertStaff, COPY } from "@/lib/notify";

let branch: string;
async function newApplicant(extra: object = {}) {
  const r = await createApplication({ course: "personnel-licensing", branch, session: "WEEKDAY", start: upcomingIntakes(4)[0].key, fullName: "Flow Test", phone: uniquePhone(), dob: "2002-02-02", educationLevel: "Other", institution: "S", completionYear: "2020", ...extra } as never, {});
  if (!r.ok) throw new Error(r.error); return db.applicant.findUniqueOrThrow({ where: { reference: r.reference } });
}
beforeAll(async () => { branch = (await db.branch.findFirstOrThrow({ where: { code: "KGL" } })).id; });

describe("admissions workflow rules (SRS 5, ADM-04)", () => {
  it("cannot skip document verification", async () => {
    const a = await newApplicant(); expect(await advanceApplicant(a.id, "QA")).toMatch(/Verify every required document/);
    expect((await db.applicant.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("SUBMITTED");
  });
  it("walks the full status path and logs and notifies every step", async () => {
    const a = await newApplicant(); await db.documentItem.updateMany({ where: { applicantId: a.id }, data: { status: "VERIFIED" } });
    for (const s of ["DOCUMENTS_VERIFIED", "REGISTRATION_PAID", "ADMITTED", "ENROLLED"]) { expect(await advanceApplicant(a.id, "QA")).toBeNull(); expect((await db.applicant.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(s); }
    expect(await advanceApplicant(a.id, "QA")).toMatch(/Already enrolled/);
    expect(await db.applicationEvent.count({ where: { applicantId: a.id, type: "STATUS" } })).toBe(5);
    expect(await db.notification.count({ where: { applicantId: a.id, channel: "WHATSAPP" } })).toBe(5);
  });
  it("blocks registration-paid while an invoice is unpaid, and allows it once Finance marks it paid", async () => {
    const a = await newApplicant(); await db.documentItem.updateMany({ where: { applicantId: a.id }, data: { status: "VERIFIED" } });
    await db.invoice.create({ data: { reference: "INV-QA-" + Date.now(), applicantId: a.id, description: "Fee", amountMinor: 1000 } });
    await advanceApplicant(a.id, "QA"); expect(await advanceApplicant(a.id, "QA")).toMatch(/not paid/);
    await db.invoice.updateMany({ where: { applicantId: a.id }, data: { status: "PAID" } }); expect(await advanceApplicant(a.id, "QA")).toBeNull();
  });
  it("does not advance closed or unknown applications", async () => {
    const a = await newApplicant(); await db.applicant.update({ where: { id: a.id }, data: { status: "REJECTED" } });
    expect(await advanceApplicant(a.id, "QA")).toMatch(/closed/i); expect(await advanceApplicant("nope", "QA")).toMatch(/not found/i);
  });
  it("places an enrolled student in the one class group for their programme, branch, intake and session (TTB-01)", async () => {
    const a = await newApplicant(); const where = { programmeId: a.programmeId, branchId: a.branchId, intakeId: a.intakeId, session: "WEEKDAY" as const };
    await db.documentItem.updateMany({ where: { applicantId: a.id }, data: { status: "VERIFIED" } }); for (let i = 0; i < 4; i++) await advanceApplicant(a.id, "QA");
    const done = await db.applicant.findUniqueOrThrow({ where: { id: a.id }, include: { classGroup: true } }); expect(done.status).toBe("ENROLLED");
    expect([done.classGroup!.programmeId, done.classGroup!.branchId, done.classGroup!.intakeId, done.classGroup!.session]).toEqual([where.programmeId, where.branchId, where.intakeId, "WEEKDAY"]);
    const before = await db.classGroup.count({ where }); const b2 = await newApplicant(); await db.documentItem.updateMany({ where: { applicantId: b2.id }, data: { status: "VERIFIED" } }); for (let i = 0; i < 4; i++) await advanceApplicant(b2.id, "QA");
    expect((await db.applicant.findUniqueOrThrow({ where: { id: b2.id } })).classGroupId).toBe(done.classGroupId); expect(await db.classGroup.count({ where })).toBe(before);
  });
});

describe("intake rows, clash detection, catalogue and notifications", () => {
  it("creates an intake once and reuses it", async () => {
    const k = upcomingIntakes(6)[5].key; const i1 = await ensureIntake(k), i2 = await ensureIntake(k); expect(i1?.id).toBe(i2?.id); expect(await ensureIntake("1999-01")).toBeNull(); expect(await ensureIntake(undefined)).toBeNull();
  });
  it("detects lecturer, room and group clashes but allows adjacent classes (TTB-02)", async () => {
    const g = await db.classGroup.findFirstOrThrow(); const room = await db.room.findFirstOrThrow(); const l = await db.user.findFirstOrThrow({ where: { role: "LECTURER" } });
    const slot = await db.timetableSlot.create({ data: { groupId: g.id, roomId: room.id, lecturerId: l.id, dayOfWeek: 5, startMin: 600, endMin: 720, subject: "QA" } });
    const other = await db.room.create({ data: { name: "QA room " + Date.now(), branchId: room.branchId } }); const otherL = await db.user.create({ data: { email: `qa${Date.now()}@x.invalid`, name: "QA L", passwordHash: "x", role: "LECTURER" } });
    const og = await db.classGroup.create({ data: { name: "QA g2 " + Date.now(), programmeId: g.programmeId, branchId: g.branchId, intakeId: g.intakeId } });
    expect(await findClash({ groupId: og.id, roomId: other.id, lecturerId: l.id, dayOfWeek: 5, startMin: 660, endMin: 780 })).toMatch(/already teaches/);
    expect(await findClash({ groupId: og.id, roomId: room.id, lecturerId: otherL.id, dayOfWeek: 5, startMin: 660, endMin: 780 })).toMatch(/already booked/);
    expect(await findClash({ groupId: g.id, roomId: other.id, lecturerId: otherL.id, dayOfWeek: 5, startMin: 660, endMin: 780 })).toMatch(/already has a class/);
    expect(await findClash({ groupId: og.id, roomId: other.id, lecturerId: otherL.id, dayOfWeek: 5, startMin: 720, endMin: 800 })).toBeNull();
    expect(await findClash({ groupId: g.id, roomId: room.id, lecturerId: l.id, dayOfWeek: 5, startMin: 600, endMin: 720, ignoreId: slot.id })).toBeNull();
  });
  it("catalogue exposes only published programmes with valid areas", async () => {
    const { courses, areas } = await getCatalogue(); const published = await db.programme.count({ where: { status: "PUBLISHED" } });
    expect(courses.length).toBe(published); expect(areas.reduce((n, a) => n + a.count, 0)).toBe(published); expect(areas.every((a) => a.count > 0)).toBe(true);
    const f = featured(courses, 6); expect(new Set(f.map((c) => c.areaId)).size).toBe(f.length);
  });
  it("records a failed email without throwing when the mail server is unreachable (NFR reliability)", async () => {
    const a = await newApplicant({ email: "fail@example.com" });
    process.env.SMTP_PASS = "x"; process.env.SMTP_HOST = "127.0.0.1"; process.env.SMTP_PORT = "1"; process.env.SMTP_SECURE = "false";
    await expect(notifyApplicant(a.id, COPY.placement)).resolves.toBeUndefined(); await expect(alertStaff("s", "t")).resolves.toBeUndefined();
    const failed = await db.notification.findFirst({ where: { applicantId: a.id, channel: "EMAIL", template: "placement" } }); expect(failed?.status).toBe("FAILED"); expect(failed?.error).toBeTruthy();
    delete process.env.SMTP_PASS; delete process.env.SMTP_HOST; delete process.env.SMTP_PORT; delete process.env.SMTP_SECURE;
  });
  it("does not email an applicant who gave only a phone number", async () => {
    const a = await newApplicant(); await notifyApplicant(a.id, COPY.placement);
    expect(await db.notification.count({ where: { applicantId: a.id, channel: "EMAIL" } })).toBe(0);
  });
});
