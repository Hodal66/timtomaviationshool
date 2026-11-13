import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { db, loginStaff, staff, signIn, uniqueEmail, uniquePhone } from "./helpers";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"); const PW = "lecturer-pass-123";
test.describe.serial("Learning resources (RES)", () => {
  const lec = `res.lect.${Date.now()}@test.local`, student = uniqueEmail(), title = `Chicago Convention notes ${Date.now()}`; let progId = "";
  test.beforeAll(async () => {
    await db.user.create({ data: { email: lec, name: "Rita QA Lecturer", role: "LECTURER", passwordHash: await bcrypt.hash(PW, 4), lecturer: { create: {} } } });
    const prog = await db.programme.findFirstOrThrow({ where: { slug: "personnel-licensing" } }); progId = prog.id; const br = await db.branch.findFirstOrThrow(); const it = await db.intake.findFirstOrThrow();
    await db.applicant.create({ data: { fullName: "Resource Student", email: student, phone: uniquePhone(), reference: "TAS-RS-" + Date.now(), status: "ENROLLED", programmeId: prog.id, branchId: br.id, intakeId: it.id } });
  });
  test("RES upload: a lecturer uploads a PDF with metadata; it waits for review and students do not see it yet", async ({ page }) => {
    await loginStaff(page, { email: lec, password: PW }); await expect(page.locator(".ds-nav")).toContainText("Resources"); await page.goto("/resources"); const f = page.locator("#upload-form");
    await f.locator("#ru-t").fill(title); await f.locator("select[name=programmeId]").selectOption(progId); await f.locator("input[name=module]").fill("Air law QA"); await f.locator("input[name=tags]").fill("ICAO, law"); await f.locator("select[name=kind]").selectOption("NOTES");
    await f.locator("#ru-f").setInputFiles({ name: "chicago.exe", mimeType: "application/x-msdownload", buffer: PDF }); await f.getByRole("button", { name: "Save resource" }).click(); await expect(page.locator("#ru-msg")).toContainText("Upload PDF");
    await f.locator("#ru-f").setInputFiles({ name: "chicago.pdf", mimeType: "application/pdf", buffer: PDF }); await f.getByRole("button", { name: "Save resource" }).click(); await expect(page.locator("#ru-msg")).toContainText("Resource saved");
    await page.goto("/resources?view=mine"); await page.locator(".dt-search input").fill(title); await expect(page.locator("tbody tr")).toHaveCount(1); await expect(page.locator("tbody tr")).toContainText("In review");
    const r = await db.resource.findFirstOrThrow({ where: { title } }); expect([r.module, r.tags, r.status]).toEqual(["Air law QA", ["icao", "law"], "IN_REVIEW"]);
    const st = await page.context().browser()!.newContext(); const sp = await st.newPage(); await signIn(sp.request, student); expect((await sp.request.get(`/api/resources/${r.id}`)).status()).toBe(403); await st.close();
  });
  test("RES review: Academic staff approve from the queue; the student opens it in the browser, downloads it and gets the module as a ZIP", async ({ page, browser }) => {
    await loginStaff(page, await staff("ACADEMIC")); await page.goto("/resources?view=review"); const card = page.locator("[data-review]", { hasText: title }); await card.getByRole("button", { name: "Reject" }).click(); await expect(page.locator("p.err")).toContainText("Say what must change");
    await page.locator("[data-review]", { hasText: title }).getByRole("button", { name: "Approve" }).click(); await page.waitForURL(/ok=1/); const r = await db.resource.findFirstOrThrow({ where: { title } }); expect(r.status).toBe("APPROVED");
    const ctx = await browser.newContext(); const sp = await ctx.newPage(); await signIn(sp.request, student); await sp.goto("/me"); await sp.getByRole("tab", { name: "Resources" }).click();
    const item = sp.locator("[data-res]", { hasText: title }); await expect(item).toBeVisible(); await expect(sp.locator('[data-module="Air law QA"]')).toContainText("Download all (ZIP)");
    const view = await sp.request.get(`/api/resources/${r.id}`); expect(view.headers()["content-disposition"]).toMatch(/^inline/); expect((await view.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const dl = await sp.request.get(`/api/resources/${r.id}?dl=1`); expect(dl.headers()["content-disposition"]).toMatch(/^attachment/);
    const zip = await sp.request.get(`/api/resources/zip?programmeId=${progId}&module=${encodeURIComponent("Air law QA")}`); expect(zip.headers()["content-type"]).toBe("application/zip"); expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");
    const after = await db.resource.findUniqueOrThrow({ where: { id: r.id } }); expect(after.views).toBeGreaterThanOrEqual(1); expect(after.downloads).toBeGreaterThanOrEqual(2); await ctx.close();
  });
  test("RES view-only, versions and recycle bin: students cannot download a view-only item; a new version is kept; deleted items leave the student list and can be restored", async ({ page, browser }) => {
    const r = await db.resource.findFirstOrThrow({ where: { title } }); await loginStaff(page, await staff("ACADEMIC")); await page.goto(`/resources/${r.id}`);
    await page.locator("#meta-form input[name=viewOnly]").check(); await page.locator("#meta-form").getByRole("button", { name: "Save details" }).click(); await page.waitForURL(/ok=1/);
    await page.locator("#rv-f").setInputFiles({ name: "chicago-v2.pdf", mimeType: "application/pdf", buffer: PDF }); await page.fill("#rv-n", "Added Annex list"); await page.getByRole("button", { name: "Save new version" }).click(); await expect(page.locator("#rv-msg")).toContainText("New version saved");
    await expect(page.locator("#versions li")).toHaveCount(2); await expect(page.locator("#versions")).toContainText("Added Annex list");
    const ctx = await browser.newContext(); const sp = await ctx.newPage(); await signIn(sp.request, student); expect((await sp.request.get(`/api/resources/${r.id}?dl=1`)).status()).toBe(403); expect((await sp.request.get(`/api/resources/${r.id}`)).status()).toBe(200);
    await sp.goto("/me"); await sp.getByRole("tab", { name: "Resources" }).click(); await expect(sp.locator("[data-res]", { hasText: title })).toContainText("View only"); await expect(sp.locator("[data-res]", { hasText: title }).getByRole("link", { name: "Download", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Move to recycle bin" }).click(); await page.waitForURL(/view=bin/); await expect(page.locator("[data-bin]", { hasText: title })).toBeVisible(); expect((await sp.request.get(`/api/resources/${r.id}`)).status()).toBe(403);
    await page.locator("[data-bin]", { hasText: title }).getByRole("button", { name: "Restore" }).click(); await expect(page.locator("[data-bin]", { hasText: title })).toHaveCount(0); expect((await db.resource.findUniqueOrThrow({ where: { id: r.id } })).deletedAt).toBeNull(); expect((await sp.request.get(`/api/resources/${r.id}`)).status()).toBe(200); await ctx.close();
  });
});
