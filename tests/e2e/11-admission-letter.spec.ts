import { test, expect } from "@playwright/test";
import { db, loginStaff, apiApply, uniqueEmail } from "./helpers";
import { letterCode } from "../../src/lib/letter";

test.describe("Admissions completion (ADM-01, ADM-06, ADM-07)", () => {
  test("ADM-06/07 Entry requirements must be confirmed before admission; the admission letter is then issued, downloadable and verifiable by QR link", async ({ page, browser }) => {
    process.env.AUTH_SECRET ??= "qa-only-secret-not-for-production-0123456789abcdef";
    await db.programme.update({ where: { slug: "personnel-licensing" }, data: { entryRequirements: ["A2 certificate or equivalent", "Basic English"], registrationFeeRwf: 0 } });
    const email = uniqueEmail(); const a = await apiApply(page.request, { email, fullName: "Letter Tester" }); const ref = a.body.reference as string; const rec = await db.applicant.findFirstOrThrow({ where: { reference: ref } });
    expect((await page.request.get(`/api/letters/${ref}`)).status(), "no letter before admission").toBe(409);
    await db.documentItem.updateMany({ where: { applicantId: rec.id }, data: { status: "VERIFIED" } }); await db.invoice.updateMany({ where: { applicantId: rec.id }, data: { status: "PAID" } }); await db.applicant.update({ where: { id: rec.id }, data: { status: "REGISTRATION_PAID" } });
    const sctx = await browser.newContext(); const sp = await sctx.newPage(); await loginStaff(sp); await sp.goto(`/admissions?view=board&q=${ref}`);
    await Promise.all([sp.waitForURL(/e=/), sp.locator(".card").getByRole("button", { name: "Next stage" }).click()]); await expect(sp.locator(".err")).toContainText("Confirm the entry requirements first"); expect((await db.applicant.findUniqueOrThrow({ where: { id: rec.id } })).status).toBe("REGISTRATION_PAID");
    await sp.goto(`/admissions/${rec.id}`); await sp.getByLabel("A2 certificate or equivalent").check(); await sp.getByLabel("Basic English").check(); await sp.getByRole("button", { name: "Save requirements" }).click(); await expect(sp.locator(".pill", { hasText: "2 of 2 confirmed" })).toBeVisible();
    await sp.goto(`/admissions?view=board&q=${ref}`); await Promise.all([sp.waitForResponse((r) => r.request().method() === "POST"), sp.locator(".card").getByRole("button", { name: "Next stage" }).click()]);
    await expect.poll(async () => (await db.applicant.findUniqueOrThrow({ where: { id: rec.id } })).status).toBe("ADMITTED"); expect((await db.applicant.findUniqueOrThrow({ where: { id: rec.id } })).admittedAt).not.toBeNull();
    const staffPdf = await sp.request.get(`/api/letters/${ref}`); expect([staffPdf.status(), staffPdf.headers()["content-type"]]).toEqual([200, "application/pdf"]);
    await page.goto("/me"); const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download admission letter" }).click()]); expect(dl.suggestedFilename()).toBe(`Admission-letter-${ref}.pdf`);
    const other = await browser.newContext(); expect((await other.request.get(`/api/letters/${ref}`)).status(), "strangers cannot download").toBe(403);
    const v = await other.newPage(); await v.goto(`/verify?letter=${ref}&k=${letterCode(ref)}`); await expect(v.locator(".pill.ok", { hasText: "Genuine" })).toBeVisible(); await expect(v.locator("main, body")).toContainText("Letter Tester"); await expect(v.locator("body")).toContainText("Personnel Licensing");
    await v.goto(`/verify?letter=${ref}&k=AAAAAAAAAAAA`); await expect(v.locator(".err")).toContainText("Not confirmed"); await expect(v.locator("body")).not.toContainText("Letter Tester"); await other.close(); await sctx.close();
    await db.programme.update({ where: { slug: "personnel-licensing" }, data: { entryRequirements: [] } });
  });
  test("ADM-01 Staff record an enquiry from WhatsApp or another channel; it appears in the list with its source and on the dashboard count", async ({ page }) => {
    await loginStaff(page); const before = await db.lead.count({ where: { status: "NEW" } }); await page.goto("/enquiries"); const name = "Channel Enquirer " + Date.now();
    await page.fill("form.panel input[name=name]", name); await page.fill("form.panel input[name=contact]", "+250788123456"); await page.selectOption("form.panel select[name=source]", "WhatsApp"); await page.fill("form.panel input[name=message]", "Asked about cabin crew fees"); await page.getByRole("button", { name: "Add", exact: true }).click(); await page.waitForURL(/ok=1/);
    const lead = await db.lead.findFirstOrThrow({ where: { name } }); expect([lead.source, lead.phone, lead.status]).toEqual(["WhatsApp", "+250788123456", "NEW"]); expect(await db.lead.count({ where: { status: "NEW" } })).toBe(before + 1);
    await page.locator(".dt-search input").fill(name); await expect(page.locator("tbody tr")).toHaveCount(1); await expect(page.locator("tbody tr")).toContainText("WhatsApp"); await expect(page.locator("tbody tr")).toContainText("cabin crew fees");
  });
});
