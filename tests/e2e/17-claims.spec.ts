import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { db, loginStaff, staff } from "./helpers";

const PW = "lecturer-pass-123";
/** Previous calendar month and its Mondays (the class day used below). */
function lastMonth() { const n = new Date(); const y = n.getUTCMonth() === 0 ? n.getUTCFullYear() - 1 : n.getUTCFullYear(), m = n.getUTCMonth() === 0 ? 12 : n.getUTCMonth(); const p = `${y}-${String(m).padStart(2, "0")}`;
  const days: string[] = []; for (let d = new Date(Date.UTC(y, m - 1, 1)); d.getUTCMonth() === m - 1; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() === 1) days.push(d.toISOString().slice(0, 10)); return { p, days }; }

test.describe.serial("Lecturer pay claims (LEC-17..22, LEC-25)", () => {
  const email = `claim.lect.${Date.now()}@test.local`; const { p, days } = lastMonth(); let uid = "";
  test.beforeAll(async () => {
    const u = await db.user.create({ data: { email, name: "Claire QA Claimant", role: "LECTURER", passwordHash: await bcrypt.hash(PW, 4), lecturer: { create: { rate: 12000, payModel: "HOUR", currency: "RWF" } } } }); uid = u.id;
    const { ensureGroup } = await import("../../src/lib/teaching"); const prog = await db.programme.findFirstOrThrow({ where: { slug: "personnel-licensing" } }); const br = await db.branch.findFirstOrThrow(); const it = await db.intake.findFirstOrThrow({ orderBy: { startsOn: "asc" } }); await db.intake.update({ where: { id: it.id }, data: { startsOn: new Date("2020-01-01") } });
    const g = await ensureGroup({ programmeId: prog.id, branchId: br.id, intakeId: it.id, session: "WEEKDAY" }); const room = await db.room.create({ data: { name: "Claim Room " + Date.now(), branchId: br.id } });
    const slot = await db.timetableSlot.create({ data: { groupId: g.id, roomId: room.id, lecturerId: uid, dayOfWeek: 1, startMin: 1020, endMin: 1140, subject: "Cargo handling" } });
    const st = await db.applicant.create({ data: { fullName: "Claim Student", email: `cs.${Date.now()}@example.com`, phone: `+2507${String(Date.now()).slice(-8)}`, reference: "TAS-CL-" + Date.now(), status: "ENROLLED", programmeId: prog.id, branchId: br.id, intakeId: it.id, classGroupId: g.id } });
    for (const d of days) { await db.lessonReport.create({ data: { slotId: slot.id, date: new Date(d), lecturerId: uid, topic: "Dangerous goods" } }); if (d !== days[1]) { const s = await db.classSession.create({ data: { slotId: slot.id, date: new Date(d) } }); await db.attendance.create({ data: { sessionId: s.id, applicantId: st.id, status: "PRESENT" } }); } }
  });
  test("LEC-18/19 The lecturer previews the month, sees what is missing, submits; the coordinator cannot approve an incomplete claim and returns it", async ({ page, browser }) => {
    await loginStaff(page, { email, password: PW }); await page.goto("/teach"); await page.selectOption("#cl-p", p);
    await expect(page.locator("#cl-preview")).toContainText(`${days.length - 1} of ${days.length} sessions can be paid`); await expect(page.locator("#cl-preview")).toContainText(`${days[1]} Cargo handling (attendance)`);
    await page.getByRole("button", { name: "Submit claim" }).click(); await expect(page.locator("#cl-msg")).toContainText("Claim submitted"); await expect(page.locator(`[data-myclaim="${p}"]`)).toContainText(`RWF ${((days.length - 1) * 24000).toLocaleString("en-US")}`); await expect(page.locator(`[data-myclaim="${p}"]`)).toContainText("Submitted");
    const ctx = await browser.newContext(); const bm = await ctx.newPage(); await loginStaff(bm, await staff("BRANCH_MANAGER")); await expect(bm.locator(".ds-nav")).toContainText("Pay claims"); await bm.goto("/claims");
    const card = bm.locator("[data-claim]", { hasText: "Claire QA Claimant" }); await expect(card.getByLabel("Clearance")).toContainText("Attendance registers: 1 missing");
    await card.getByRole("button", { name: "Approve as coordinator" }).click(); await expect(bm.locator("p.err")).toContainText("Clearance is not complete");
    await bm.locator("[data-claim]", { hasText: "Claire QA Claimant" }).getByLabel("Comment").fill(`Register for ${days[1]} is missing`); await bm.locator("[data-claim]", { hasText: "Claire QA Claimant" }).getByRole("button", { name: "Return to lecturer" }).click(); await bm.waitForURL(/ok=1/); await ctx.close();
    await page.reload(); await expect(page.locator(`[data-myclaim="${p}"]`)).toContainText("Returned"); await expect(page.locator(`[data-myclaim="${p}"]`)).toContainText(`Register for ${days[1]} is missing`);
  });
  test("LEC-20/22 After fixing, the claim goes coordinator → Head of Academics → Finance; the lecturer asks a question and sees the payment reference", async ({ page, browser }) => {
    const slot = await db.timetableSlot.findFirstOrThrow({ where: { lecturerId: uid } }); const st = await db.applicant.findFirstOrThrow({ where: { fullName: "Claim Student" }, orderBy: { createdAt: "desc" } }); const s = await db.classSession.create({ data: { slotId: slot.id, date: new Date(days[1]) } }); await db.attendance.create({ data: { sessionId: s.id, applicantId: st.id, status: "PRESENT" } });
    await loginStaff(page, { email, password: PW }); await page.goto("/teach"); const mine = page.locator(`[data-myclaim="${p}"]`); await mine.getByRole("button", { name: "Resubmit" }).click(); await expect(page.locator("#cl-msg")).toContainText("Claim submitted"); await expect(mine).toContainText(`RWF ${(days.length * 24000).toLocaleString("en-US")}`);
    const step = async (role: "BRANCH_MANAGER" | "ACADEMIC" | "FINANCE", button: string, ref?: string) => { const ctx = await browser.newContext(); const x = await ctx.newPage(); await loginStaff(x, await staff(role)); await x.goto("/claims"); const c = x.locator("[data-claim]", { hasText: "Claire QA Claimant" }); if (ref) await c.getByLabel("Transfer reference").fill(ref); await c.getByRole("button", { name: button }).click(); await x.waitForURL(/ok=1/); await ctx.close(); };
    await step("BRANCH_MANAGER", "Approve as coordinator"); await page.reload(); await mine.getByRole("button", { name: "Ask about this claim" }).click(); await mine.getByLabel("Your question").fill("When will this be paid?"); await mine.getByRole("button", { name: "Send" }).click(); await expect(page.locator("#cl-msg")).toContainText("Your question was sent"); await expect(mine).toContainText("Query sent");
    const ctx = await browser.newContext(); const ac = await ctx.newPage(); await loginStaff(ac, await staff("ACADEMIC")); await ac.goto("/claims"); const c = ac.locator("[data-claim]", { hasText: "Claire QA Claimant" }); await expect(c).toContainText("Open query"); await c.getByLabel("Comment").fill("After academic approval, Finance pays within 5 days."); await c.getByRole("button", { name: "Answer query" }).click(); await ac.waitForURL(/ok=1/); await ctx.close();
    await step("ACADEMIC", "Approve as Head of Academics"); await step("FINANCE", "Mark as paid", "BK-TRF-2026-0042");
    await page.reload(); await expect(mine).toContainText("Paid"); await expect(mine).toContainText("BK-TRF-2026-0042"); await expect(mine.getByRole("button", { name: "Ask about this claim" })).toHaveCount(0);
    const h = ((await db.paymentClaim.findUniqueOrThrow({ where: { lecturerId_period: { lecturerId: uid, period: p } } })).history as { action: string; by: string }[]).map((x) => x.action);
    expect(h).toEqual(["Submitted", "Returned", "Resubmitted", "Approved by coordinator", "Query", "Answer", "Approved by Head of Academics", "Paid (BK-TRF-2026-0042)"]);
  });
  test("LEC-25 Finance downloads the claims report as CSV; lecturers cannot open the claims page or the report", async ({ page }) => {
    await loginStaff(page, await staff("FINANCE")); await page.goto(`/claims?status=PAID&period=${p}`); await expect(page.locator("[data-kpi=PAID] b")).not.toHaveText("0");
    const csv = await (await page.request.get(`/api/claims/export?period=${p}`)).text(); expect(csv).toContain("period,lecturer,email"); expect(csv).toMatch(new RegExp(`${p},Claire QA Claimant,${email.replace(/\./g, "\\.")},HOUR,${days.length * 2},12000,RWF,${days.length * 24000},PAID,BK-TRF-2026-0042`));
    const ctx = await page.context().browser()!.newContext(); const lp = await ctx.newPage(); await loginStaff(lp, { email, password: PW }); await lp.goto("/claims"); await expect(lp).toHaveURL(/dashboard/); expect((await lp.request.get("/api/claims/export")).status()).toBe(403); await ctx.close();
  });
});
