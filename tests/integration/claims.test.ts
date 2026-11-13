import { describe, it, expect } from "vitest";
import { db, uniquePhone } from "./db";
import { createLecturer, type Actor } from "@/lib/lecturers";
import { ensureGroup } from "@/lib/teaching";
import { amountFor, buildClaim, submitClaim, actOnClaim, queryClaim, periodOk, claimsSummary, type Line } from "@/lib/claims";

let n = 0; const u = () => `${Date.now().toString(36)}${n++}`;
const acad: Actor = { uid: "acad-" + u(), name: "Academic Head", role: "ACADEMIC" }, coord: Actor = { uid: "bm-" + u(), name: "Coordinator", role: "BRANCH_MANAGER" }, fin: Actor = { uid: "fin-" + u(), name: "Finance Officer", role: "FINANCE" };
const P = "2026-09"; const MONDAYS = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"];
async function setup(payModel = "HOUR", rate = 10000) {
  const r = await createLecturer(acad, { name: "Claim Lect " + u(), email: `cl.${u()}@test.local`, password: "a-long-password", rate, payModel } as never); if (typeof r === "string") throw new Error(r); const me: Actor = { uid: r.id, name: "Claim Lect", role: "LECTURER" };
  const prog = await db.programme.create({ data: { code: "CLM" + u(), name: "Claims " + u(), type: "CERTIFICATE", status: "DRAFT", modules: [] } }); const br = await db.branch.findFirstOrThrow(); const it = await db.intake.findFirstOrThrow({ orderBy: { startsOn: "asc" } }); await db.intake.update({ where: { id: it.id }, data: { startsOn: new Date("2020-01-01") } });
  const g = await ensureGroup({ programmeId: prog.id, branchId: br.id, intakeId: it.id, session: "WEEKDAY" }); const room = await db.room.create({ data: { name: "R" + u(), branchId: br.id } });
  const slot = await db.timetableSlot.create({ data: { groupId: g.id, roomId: room.id, lecturerId: r.id, dayOfWeek: 1, startMin: 480, endMin: 600, subject: "Air law" } });
  const st = await db.applicant.create({ data: { fullName: "Claim Student", email: `cs${u()}@example.com`, phone: uniquePhone(), reference: "TAS-C-" + u().toUpperCase(), status: "ENROLLED", programmeId: prog.id, branchId: br.id, intakeId: it.id, classGroupId: g.id } });
  const deliver = async (d: string, report = true, register = true) => { if (report) await db.lessonReport.create({ data: { slotId: slot.id, date: new Date(d), lecturerId: r.id, topic: "Air law" } }); if (register) { const s = await db.classSession.create({ data: { slotId: slot.id, date: new Date(d) } }); await db.attendance.create({ data: { sessionId: s.id, applicantId: st.id, status: "PRESENT" } }); } };
  return { me, deliver };
}

describe("lecturer pay claims (LEC-17..22, LEC-25)", () => {
  it("computes the amount for each pay model from paid sessions only (LEC-17)", () => {
    const l = (date: string, group: string, paid = true): Line => ({ date, slotId: "s", subject: "x", group, hours: 2, reported: paid, attendance: paid, paid });
    const lines = [l("2026-09-07", "A"), l("2026-09-08", "B"), l("2026-09-14", "A"), l("2026-09-21", "A", false)];
    expect(amountFor("HOUR", 10000, lines)).toEqual({ units: 6, amount: 60000 }); expect(amountFor("SESSION", 15000, lines)).toEqual({ units: 3, amount: 45000 });
    expect(amountFor("MODULE", 200000, lines)).toEqual({ units: 2, amount: 400000 }); expect(amountFor("MONTHLY", 500000, lines)).toEqual({ units: 1, amount: 500000 }); expect(amountFor("MONTHLY", 500000, [])).toEqual({ units: 0, amount: 0 });
    expect([periodOk("2026-09"), periodOk("2026-13"), periodOk("26-09")]).toEqual([true, false, false]);
  });
  it("builds the month from the timetable; only sessions with a lesson report AND a register are paid; clearance lists the gaps (LEC-18, LEC-19)", async () => {
    const { me, deliver } = await setup(); await deliver(MONDAYS[0]); await deliver(MONDAYS[1]); await deliver(MONDAYS[2], true, false); await deliver(MONDAYS[3], false, true);
    const b = await buildClaim(me.uid, P); expect(b.lines.map((l) => [l.date, l.paid])).toEqual([[MONDAYS[0], true], [MONDAYS[1], true], [MONDAYS[2], false], [MONDAYS[3], false]]);
    expect(b.clearance).toMatchObject({ reports: false, attendance: false, grades: true, missingReports: 1, missingAttendance: 1 });
  });
  it("submission rules: lecturer only, no future month, no duplicate, must have paid sessions", async () => {
    const { me, deliver } = await setup(); expect(await submitClaim(acad, P)).toMatch(/Only lecturers/); expect(await submitClaim(me, "2099-01")).toMatch(/future month/); expect(await submitClaim(me, "bad")).toMatch(/Choose a month/);
    expect(await submitClaim(me, P)).toMatch(/No delivered sessions/); await deliver(MONDAYS[0]); expect(await submitClaim(me, P)).toBeNull(); expect(await submitClaim(me, P)).toMatch(/already submitted/);
    const c = await db.paymentClaim.findUniqueOrThrow({ where: { lecturerId_period: { lecturerId: me.uid, period: P } } }); expect([c.units, c.amount, c.currency, c.status]).toEqual([2, 20000, "RWF", "SUBMITTED"]);
  });
  it("coordinator cannot approve until clearance is complete; a return needs a comment and lets the lecturer fix and resubmit (LEC-19, LEC-20)", async () => {
    const { me, deliver } = await setup(); await deliver(MONDAYS[0]); await deliver(MONDAYS[1], true, false); for (const d of MONDAYS.slice(2)) await deliver(d);
    expect(await submitClaim(me, P)).toBeNull(); const c = await db.paymentClaim.findUniqueOrThrow({ where: { lecturerId_period: { lecturerId: me.uid, period: P } } });
    expect(await actOnClaim(coord, c.id, "coordinator")).toMatch(/Clearance is not complete/); expect(await actOnClaim(coord, c.id, "return")).toMatch(/Say what/);
    expect(await actOnClaim(coord, c.id, "return", "Register for 14 Sep is missing")).toBeNull(); expect((await db.paymentClaim.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("RETURNED");
    const s = await db.classSession.create({ data: { slotId: (await db.timetableSlot.findFirstOrThrow({ where: { lecturerId: me.uid } })).id, date: new Date(MONDAYS[1]) } }); const st = await db.applicant.findFirstOrThrow({ where: { email: { startsWith: "cs" } }, orderBy: { createdAt: "desc" } }); await db.attendance.create({ data: { sessionId: s.id, applicantId: st.id, status: "PRESENT" } });
    expect(await submitClaim(me, P)).toBeNull(); const c2 = await db.paymentClaim.findUniqueOrThrow({ where: { id: c.id } }); expect([c2.status, c2.amount]).toEqual(["SUBMITTED", 80000]); expect((c2.history as { action: string }[]).map((h) => h.action)).toEqual(["Submitted", "Returned", "Resubmitted"]);
  });
  it("runs the chain coordinator → Head of Academics → Finance with separate people, a payment reference, and lecturer queries (LEC-20, LEC-22)", async () => {
    const { me, deliver } = await setup("SESSION", 15000); for (const d of MONDAYS) await deliver(d); expect(await submitClaim(me, P)).toBeNull(); const id = (await db.paymentClaim.findUniqueOrThrow({ where: { lecturerId_period: { lecturerId: me.uid, period: P } } })).id;
    expect(await actOnClaim(acad, id, "academic")).toMatch(/not at this step/); expect(await actOnClaim(fin, id, "coordinator")).toMatch(/Not allowed/); expect(await actOnClaim({ ...me, role: "ACADEMIC" }, id, "coordinator")).toMatch(/your own claim/);
    expect(await actOnClaim(coord, id, "coordinator")).toBeNull(); expect(await actOnClaim({ ...coord, role: "ACADEMIC" }, id, "academic")).toMatch(/same person/);
    expect(await queryClaim({ ...me, uid: "someone-else" }, id, "Where is my money?")).toMatch(/not found/); expect(await queryClaim(me, id, "?")).toMatch(/Write your question/); expect(await queryClaim(me, id, "Why only four sessions?")).toBeNull();
    expect((await db.paymentClaim.findUniqueOrThrow({ where: { id } })).openQuery).toBe(true); expect(await actOnClaim(acad, id, "answer", "September had four Mondays.")).toBeNull(); expect((await db.paymentClaim.findUniqueOrThrow({ where: { id } })).openQuery).toBe(false);
    expect(await actOnClaim(acad, id, "academic")).toBeNull(); expect(await actOnClaim(fin, id, "finance")).toMatch(/transfer reference/); expect(await actOnClaim(fin, id, "finance", "", "MOMO-123456")).toBeNull();
    const c = await db.paymentClaim.findUniqueOrThrow({ where: { id } }); expect([c.status, c.amount, c.paidRef, !!c.paidAt]).toEqual(["PAID", 60000, "MOMO-123456", true]); expect(await actOnClaim(coord, id, "return", "late")).toMatch(/cannot be returned/);
    const sum = await claimsSummary(P); expect(sum.PAID.n).toBeGreaterThanOrEqual(1); expect(sum.PAID.RWF).toBeGreaterThanOrEqual(60000);
  });
});
