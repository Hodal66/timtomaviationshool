import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { db, loginStaff, staff, signIn, uniqueEmail, uniquePhone } from "./helpers";

const PW = "lecturer-pass-123", MEET = "https://meet.google.com/qaz-wsxe-dcr";
test.describe.serial("Online classes with Google Meet (VCL, LMS-01)", () => {
  const lec = `onl.lect.${Date.now()}@test.local`, s1 = uniqueEmail(), s2 = uniqueEmail(), school = `ama.${Date.now()}@tas.school`; let slotId = "", date = "", groupId = "", progId = "";
  test.beforeAll(async () => {
    const u = await db.user.create({ data: { email: lec, name: "Olivier QA Online", role: "LECTURER", passwordHash: await bcrypt.hash(PW, 4), lecturer: { create: {} } } });
    const { ensureGroup, kigaliDate } = await import("../../src/lib/teaching"); const prog = await db.programme.findFirstOrThrow({ where: { slug: "personnel-licensing" } }); progId = prog.id; const br = await db.branch.findFirstOrThrow(); const it = await db.intake.findFirstOrThrow({ orderBy: { startsOn: "asc" } }); await db.intake.update({ where: { id: it.id }, data: { startsOn: new Date("2020-01-01") } });
    const g = await ensureGroup({ programmeId: prog.id, branchId: br.id, intakeId: it.id, session: "WEEKDAY" }); groupId = g.id; const room = await db.room.create({ data: { name: "ONL Room " + Date.now(), branchId: br.id } });
    const d = new Date(+kigaliDate() - 2 * 864e5); date = d.toISOString().slice(0, 10); const dow = ((d.getUTCDay() + 6) % 7) + 1;
    slotId = (await db.timetableSlot.create({ data: { groupId: g.id, roomId: room.id, lecturerId: u.id, dayOfWeek: dow, startMin: 540, endMin: 660, subject: "Online QA Air law" } })).id;
    for (const [name, email, se] of [["Amani Online", s1, school], ["Bella Online", s2, null]] as const) await db.applicant.create({ data: { fullName: name, email, schoolEmail: se, phone: uniquePhone(), reference: "TAS-ON-" + Date.now() + name.length, status: "ENROLLED", programmeId: prog.id, branchId: br.id, intakeId: it.id, classGroupId: g.id } });
  });
  test("VCL-01/02 Staff make the class online with a Meet link; a fake link is refused; the student joins in one tap and outsiders cannot", async ({ page, browser }) => {
    await loginStaff(page, await staff("ACADEMIC")); await expect(page.locator(".ds-nav")).toContainText("Online classes"); await page.goto("/online"); await expect(page.locator("#meet-note")).toBeVisible();
    const card = page.locator(`[data-slot="${slotId}"]`); await card.locator("select[name=mode]").selectOption("ONLINE"); await card.locator("input[name=link]").fill("https://zoom.us/j/123"); await card.getByRole("button", { name: "Save" }).click(); await expect(page.locator("p.err")).toContainText("Google Meet link");
    await page.locator(`[data-slot="${slotId}"] select[name=mode]`).selectOption("ONLINE"); await page.locator(`[data-slot="${slotId}"] input[name=link]`).fill(MEET); await page.locator(`[data-slot="${slotId}"]`).getByRole("button", { name: "Save" }).click(); await page.waitForURL(/ok=1/);
    await expect(page.locator(`[data-slot="${slotId}"]`)).toContainText("Online"); expect((await db.timetableSlot.findUniqueOrThrow({ where: { id: slotId } })).meetUrl).toBe(MEET);
    const ctx = await browser.newContext(); const sp = await ctx.newPage(); await signIn(sp.request, s1); await sp.goto("/me"); await sp.getByRole("tab", { name: "Timetable" }).click();
    await expect(sp.locator("tr", { hasText: "Online QA Air law" }).getByRole("link", { name: "Join class" })).toHaveAttribute("href", `/api/join/${slotId}`);
    const j = await sp.request.get(`/api/join/${slotId}`, { maxRedirects: 0 }); expect(j.status()).toBe(302); expect(j.headers().location).toBe(MEET); await ctx.close();
    const anon = await browser.newContext(); expect((await anon.request.get(`/api/join/${slotId}`, { maxRedirects: 0 })).status()).toBe(403); await anon.close();
  });
  test("VCL-04/05/07 The lecturer imports the Meet report: school email matched, late and absent applied, strangers listed; a correction needs a reason and is logged", async ({ page }) => {
    await loginStaff(page, { email: lec, password: PW }); await page.goto(`/online?slot=${slotId}&date=${date}`); await expect(page.locator("h1")).toContainText(date);
    const csv = `Full name,Email,Time joined,Time exited\nAmani,${school},9:12 AM,11:00 AM\nStranger,stranger@x.org,9:00 AM,11:00 AM\n`;
    await page.setInputFiles("#mi-f", { name: "meet.csv", mimeType: "text/csv", buffer: Buffer.from(csv) }); await page.getByRole("button", { name: "Import report" }).click();
    await expect(page.locator("#mi-msg")).toContainText(/0 present, 1 late, \d+ absent/); await expect(page.locator("#mi-un")).toContainText("stranger@x.org");
    await expect(page.locator('[data-student="Amani Online"]')).toContainText("Late"); await expect(page.locator('[data-student="Amani Online"]')).toContainText("joined 12 min late"); await expect(page.locator('[data-student="Bella Online"]')).toContainText("Absent");
    const row = page.locator('[data-student="Bella Online"]'); await row.locator("select[name=status]").selectOption("EXCUSED"); await row.locator("input[name=reason]").fill("Power cut in her area, confirmed by phone"); await row.getByRole("button", { name: "Save" }).click(); await page.waitForURL(/ok=1/);
    await expect(page.locator('[data-student="Bella Online"]')).toContainText("Excused"); await expect(page.locator("#session-log")).toContainText("Corrected Bella Online: ABSENT -> EXCUSED");
  });
  test("VCL-08/LMS-01 A recording is published to the class only; the lecturer's announcement and the recording show in the student's course space", async ({ page, browser }) => {
    await loginStaff(page, { email: lec, password: PW }); await page.goto(`/online?slot=${slotId}&date=${date}`); await page.fill("#rc-u", "https://drive.google.com/file/d/qa-recording/view"); await page.getByRole("button", { name: "Publish recording" }).click(); await page.waitForURL(/ok=1/); await expect(page.locator("#rec-form")).toContainText("Published to the class");
    await page.goto("/teach"); await page.selectOption("#an-g", groupId); await page.fill("#an-t", "Online QA: bring your ICAO Annex 1"); await page.fill("#an-b", "We revise licensing on Monday."); await page.getByRole("button", { name: "Post announcement" }).click(); await expect(page.locator("#an-msg")).toContainText("posted");
    const ctx = await browser.newContext(); const sp = await ctx.newPage(); await signIn(sp.request, s1); await sp.goto("/me"); await sp.getByRole("tab", { name: "Course" }).click();
    await expect(sp.locator('[data-note="Online QA: bring your ICAO Annex 1"]')).toBeVisible(); const rec = sp.locator("[data-res]", { hasText: `Recording: Online QA Air law, ${date}` }); await expect(rec).toContainText("View only");
    const r = await db.resource.findFirstOrThrow({ where: { groupId, title: `Recording: Online QA Air law, ${date}` } }); expect((await sp.request.get(`/api/resources/${r.id}`, { maxRedirects: 0 })).status()).toBe(302); await ctx.close();
    const br = await db.branch.findFirstOrThrow(); const it = await db.intake.findFirstOrThrow(); const other = uniqueEmail(); const { ensureGroup } = await import("../../src/lib/teaching"); const g2 = await ensureGroup({ programmeId: progId, branchId: br.id, intakeId: it.id, session: "WEEKEND" });
    await db.applicant.create({ data: { fullName: "Other Group", email: other, phone: uniquePhone(), reference: "TAS-ON-X" + Date.now(), status: "ENROLLED", programmeId: progId, branchId: br.id, intakeId: it.id, classGroupId: g2.id } });
    const c2 = await browser.newContext(); const op = await c2.newPage(); await signIn(op.request, other); expect((await op.request.get(`/api/resources/${r.id}`, { maxRedirects: 0 })).status()).toBe(403); await c2.close();
  });
});
