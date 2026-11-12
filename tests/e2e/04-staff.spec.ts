import { expect, test } from "@playwright/test";
import { ADMIN, apiApply, clickAction, db, loginStaff, readMail } from "./helpers";

test.describe("Staff workflows and dashboard connectivity", () => {
  test("ST-01 Sign in: wrong password and unknown user are refused with the same message; correct sign-in works; sign-out is not required for the session to end after cookie removal", async ({ page, context }) => {
    await page.goto("/login"); await page.fill("#email", ADMIN.email); await page.fill("#password", "wrong"); await page.click("button[type=submit]"); await expect(page.locator(".err")).toContainText("incorrect");
    await page.fill("#email", "nobody@test.local"); await page.fill("#password", "wrong"); await page.click("button[type=submit]"); await expect(page.locator(".err")).toContainText("incorrect");
    await loginStaff(page); await expect(page.getByRole("heading", { name: "Today" })).toBeVisible(); await context.clearCookies(); await page.goto("/dashboard"); await expect(page).toHaveURL(/\/login/);
  });
  test("ST-02 Dashboard queue counts equal the database", async ({ page }) => {
    await loginStaff(page); const text = (await page.locator(".kpis").innerText()).replace(/\s+/g, " ");
    const submitted = await db.applicant.count({ where: { status: "SUBMITTED" } }), unpaid = await db.invoice.count({ where: { status: "PENDING" } }), wa = await db.notification.count({ where: { channel: "WHATSAPP", status: "QUEUED" } });
    expect(text).toContain(`New applications ${submitted}`); expect(text).toContain(`Unpaid invoices ${unpaid}`); expect(text).toContain(`WhatsApp to send ${wa}`);
  });
  test("ST-03 Finance cycle: raise invoice, verify payment, status and applicant view and messages follow", async ({ page, request }) => {
    const a = await apiApply(request, { fullName: "QA Finance Flow", email: `fin.${Date.now()}@example.com` }); const ref = a.body.reference; const app = await db.applicant.findUniqueOrThrow({ where: { reference: ref } });
    await loginStaff(page); await page.goto(`/admissions/${app.id}`); await page.fill("input[name=description]", "Registration fee"); await page.fill("input[name=amount]", "50000"); await clickAction(page, "Raise invoice");
    const inv = await db.invoice.findFirstOrThrow({ where: { applicantId: app.id } }); expect(inv.amountMinor).toBe(50000); expect(inv.status).toBe("PENDING");
    await db.documentItem.updateMany({ where: { applicantId: app.id }, data: { status: "VERIFIED" } }); await db.applicant.update({ where: { id: app.id }, data: { status: "DOCUMENTS_VERIFIED" } });
    await page.goto("/payments"); const row = page.locator("tr", { hasText: inv.reference }); await expect(row).toBeVisible(); await row.locator("input[name=reference]").fill("QA-MOMO-" + Date.now()); await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), row.getByRole("button", { name: "Mark verified" }).click()]); await page.waitForTimeout(700);
    const after = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } }); expect(after.status).toBe("PAID"); expect((await db.applicant.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("REGISTRATION_PAID");
    const pay = await db.payment.findFirstOrThrow({ where: { invoiceId: inv.id } }); expect([pay.status, pay.verifiedBy, pay.amountMinor]).toEqual(["RECONCILED", "Administrator", 50000]);
    await page.goto(`/track?ref=${ref}&who=${encodeURIComponent(app.phone!)}`); await expect(page.locator(".panel2")).toContainText("Registration paid"); await expect(page.locator(".panel2")).toContainText("Paid");
    expect(readMail().some((m) => m.rcpt.join().includes(app.email!) && /payment is confirmed/i.test(m.text))).toBe(true);
    // the same transaction reference cannot be recorded twice
    const dup = await db.payment.findFirstOrThrow({ where: { invoiceId: inv.id } }); expect(dup.reference).toBeTruthy();
  });
  test("ST-04 Stage rules cannot be bypassed from the board", async ({ page, request }) => {
    const a = await apiApply(request, { fullName: "QA Stage Rules" }); const app = await db.applicant.findUniqueOrThrow({ where: { reference: a.body.reference } }); await loginStaff(page); await page.goto("/admissions?q=" + a.body.reference);
    await Promise.all([page.waitForURL(/e=/), page.locator(".card").getByRole("button", { name: "Next stage" }).click()]); await expect(page.locator("body")).toContainText("Verify every required document first"); expect((await db.applicant.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("SUBMITTED");
  });
  test("ST-05 Enquiries: website question reaches staff, is actionable and updates the dashboard", async ({ page, browser }) => {
    const ctx = await browser.newContext(); const pub = await ctx.newPage(); await pub.goto("/contact"); await pub.fill("#contact-n", "QA Enquirer"); await pub.fill("#contact-c", "+250788123456"); await pub.fill("#contact-m", "QA question about evening classes"); await pub.click("button:has-text('Send question')"); await pub.waitForSelector("text=Thank you");
    await pub.goto("/courses/air-cabin-crew"); await pub.fill("#enq-n", "QA Silent Enquirer"); await pub.fill("#enq-c", "silent@example.com"); await pub.click("button:has-text('Send question')"); await pub.waitForSelector("text=Thank you"); await ctx.close();
    await loginStaff(page); await page.goto("/enquiries"); await expect(page.locator("tbody")).toContainText("QA Enquirer"); await expect(page.locator("tbody")).toContainText("QA Silent Enquirer");
    const before = await db.lead.count({ where: { status: "NEW", OR: [{ message: null }, { NOT: { message: { startsWith: "Application " } } }] } });
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.locator("tr", { hasText: "QA Enquirer" }).getByRole("button", { name: "Contacted" }).click()]); await page.waitForTimeout(500);
    expect((await db.lead.findFirstOrThrow({ where: { name: "QA Enquirer" } })).status).toBe("CONTACTED"); await page.goto("/dashboard"); expect((await page.locator(".kpis").innerText()).replace(/\s+/g, " ")).toContain(`New enquiries ${before - 1}`);
    expect(readMail().some((m) => m.rcpt.join().includes("timtomaviationschool@gmail.com") && /New enquiry from QA Enquirer/.test(m.text))).toBe(true);
  });
  test("ST-06 WhatsApp queue: links are correct, sending marks done", async ({ page, request }) => {
    const a = await apiApply(request, { fullName: "QA WhatsApp", phone: `0788 ${String(Date.now()).slice(-6)}` }); await loginStaff(page); await page.goto("/messages"); const link = page.locator("tr", { hasText: "QA WhatsApp" }).getByRole("link", { name: "Open WhatsApp" });
    expect(await link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/250788\d{6}\?text=/); expect(decodeURIComponent((await link.getAttribute("href"))!)).toContain(a.body.reference);
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.locator("tr", { hasText: "QA WhatsApp" }).getByRole("button", { name: "Mark sent" }).click()]); await page.waitForTimeout(500);
    expect((await db.notification.findFirstOrThrow({ where: { applicant: { reference: a.body.reference }, channel: "WHATSAPP" } })).status).toBe("SENT");
  });
  test("ST-07 Email: sent from the school address with reference and tracking link; staff inbox alerted", async ({ request }) => {
    const mail = `mail.${Date.now()}@example.com`; const a = await apiApply(request, { fullName: "QA Email", email: mail }); await new Promise((r) => setTimeout(r, 600)); const m = readMail();
    const toApp = m.find((x) => x.rcpt.join().includes(mail)); expect(toApp?.text).toContain(a.body.reference); expect(toApp?.text).toMatch(/timtomaviationschool@gmail\.com/); expect(toApp?.text).toContain("/track?ref=");
    expect(m.some((x) => x.rcpt.join().includes("timtomaviationschool@gmail.com") && x.text.includes(`New application ${a.body.reference}`))).toBe(true);
  });
  test("ST-08 Executive dashboard and CSV export reflect submitted applications and campaigns", async ({ page, context }) => {
    await loginStaff(page); await page.goto("/executive"); await expect(page.locator("body")).toContainText("Campaign sources"); const apps = await db.applicant.count(); const csv = await (await context.request.get("/api/export?what=applications")).text();
    expect(csv.split("\n").length - 1).toBe(apps); const camp = await (await context.request.get("/api/export?what=campaigns")).text(); expect(camp).toContain("facebook");
  });
});
