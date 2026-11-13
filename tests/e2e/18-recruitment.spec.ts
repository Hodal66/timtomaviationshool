import { test, expect } from "@playwright/test";
import { db, loginStaff, staff } from "./helpers";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
test.describe.serial("Lecturer recruitment (LEC-07, LEC-08, LEC-10)", () => {
  const title = `Lecturer, Air Cargo QA ${Date.now()}`, email = `cand.${Date.now()}@example.com`; let slug = "", appId = "";
  test("LEC-07 Academic staff create a vacancy, publish it, and it appears on the public careers page", async ({ page }) => {
    await loginStaff(page, await staff("ACADEMIC")); await expect(page.locator(".ds-nav")).toContainText("Recruitment"); await page.goto("/recruitment");
    const f = page.locator("#vacancy-form"); await f.locator("input[name=title]").fill(title); await f.locator("textarea[name=description]").fill("Teach air cargo operations and dangerous goods to evening classes in Kigali.");
    await f.locator("input[name=subjects]").fill("Cargo, Dangerous goods"); await f.locator("textarea[name=requirements]").fill("Five years in air cargo\nIATA DGR certificate"); await f.getByRole("button", { name: "Create vacancy" }).click(); await page.waitForURL(/ok=1/);
    const card = page.locator("[data-vac]", { hasText: title }); await expect(card).toContainText("Draft"); const v = await db.vacancy.findFirstOrThrow({ where: { title } }); slug = v.slug;
    expect((await page.request.get(`/careers/${slug}`)).status()).toBe(404); await card.getByRole("button", { name: "Publish" }).click(); await page.waitForURL(/ok=1/); await expect(page.locator("[data-vac]", { hasText: title })).toContainText("Published");
    const pub = await page.context().browser()!.newContext(); const p = await pub.newPage(); await p.goto("/careers"); await expect(p.locator(`[data-vacancy="${slug}"]`)).toContainText(title); await p.goto("/"); await expect(p.locator("footer")).toContainText("Teach with us"); await pub.close();
  });
  test("LEC-08 A candidate applies online with a CV and answers the screening questions; a fake file is refused", async ({ page }) => {
    await page.goto(`/careers/${slug}`); await expect(page.locator("h1")).toContainText(title); await page.fill("#ja-n", "Aline QA Candidate"); await page.fill("#ja-e", email); await page.fill("#ja-p", "0788 111 222");
    await page.locator("input[name=q0][value=yes]").check(); await page.setInputFiles("#ja-cv", { name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("not really a pdf") }); await page.getByRole("button", { name: "Send application" }).click(); await expect(page.locator("p.err")).toContainText("does not look like a real PDF");
    await page.setInputFiles("#ja-cv", { name: "Aline-CV.pdf", mimeType: "application/pdf", buffer: PDF }); await page.fill("#ja-c", "Ten years at the cargo terminal."); await page.getByRole("button", { name: "Send application" }).click(); await expect(page.locator("#job-done")).toContainText(/TAS-J-[0-9A-F]{6}/);
    const j = await db.jobApplication.findFirstOrThrow({ where: { email } }); appId = j.id; expect([j.status, j.score, j.phone]).toEqual(["NEW", 50, "0788111222"]);
  });
  test("LEC-08/10 Staff screen, interview, offer (verifiable letter), hire and onboard; the new lecturer can sign in", async ({ page, browser }) => {
    await loginStaff(page, await staff("ACADEMIC")); await page.goto("/recruitment"); await page.locator(".dt-search input").fill("Aline QA"); await page.getByRole("link", { name: "Aline QA Candidate" }).click(); await expect(page.locator("#job-score")).toHaveText("50%");
    const cv = await page.request.get(`/api/careers/cv/${appId}`); expect(cv.status()).toBe(200); expect((await cv.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await page.getByRole("button", { name: "Shortlist" }).click(); await page.waitForURL(/ok=1/); await page.getByRole("button", { name: "Invite to interview" }).click(); await page.waitForURL(/ok=1/); await expect(page.locator("#job-status")).toHaveText("Interview");
    await page.fill("input[name=rate]", "14000"); await page.fill("input[name=startDate]", new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)); await page.getByRole("button", { name: "Make offer" }).click(); await page.waitForURL(/ok=1/); await expect(page.locator("#job-status")).toHaveText("Offered");
    const pdf = await page.request.get(`/api/careers/offer/${appId}`); expect(pdf.headers()["content-type"]).toBe("application/pdf"); const ref = (await db.jobApplication.findUniqueOrThrow({ where: { id: appId } })).reference;
    const { docCode } = await import("../../src/lib/docs"); const ver = await browser.newContext(); const vp = await ver.newPage(); await vp.goto(`/verify?doc=OFFER-${ref}&k=${docCode("OFFER-" + ref)}`); await expect(vp.locator(".pill.ok", { hasText: "Genuine" })).toBeVisible(); await expect(vp.locator("body")).toContainText("Offer of engagement to Aline QA Candidate"); await ver.close();
    await page.fill("#hi-p", "first-pass-123456"); await page.getByRole("button", { name: "Hire and create account" }).click(); await page.waitForURL(/ok=1/); await expect(page.locator("#job-status")).toHaveText("Hired");
    await page.locator('[data-ob="Signed contract received"] button').click(); await page.waitForURL(/ok=1/); await expect(page.locator("#onboarding")).toContainText("1 / 6");
    const u = await db.user.findUniqueOrThrow({ where: { email }, include: { lecturer: true } }); expect([u.role, u.lecturer?.rate]).toEqual(["LECTURER", 14000]);
    const lc = await browser.newContext(); const lp = await lc.newPage(); await loginStaff(lp, { email, password: "first-pass-123456" }); await expect(lp.locator(".ds-nav")).toContainText("My teaching"); expect((await lp.request.get(`/api/careers/cv/${appId}`)).status()).toBe(403); await lc.close();
  });
});
