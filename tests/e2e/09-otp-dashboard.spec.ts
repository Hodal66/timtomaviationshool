import { test, expect } from "@playwright/test";
import { db, readMail, signIn, uniqueEmail, uniquePhone, FIX, apiApply } from "./helpers";

const lastCode = async (email: string, before: number) => { for (let i = 0; i < 60; i++) { const m = readMail().slice(before).reverse().find((x) => x.rcpt.some((a) => a.includes(email))); const c = m?.text.match(/verification code is (\d{6})/); if (c) return { code: c[1], text: m!.text }; await new Promise((r) => setTimeout(r, 150)); } throw new Error("no code email"); };

test.describe("Email verification (OTP) and applicant dashboard", () => {
  test("OTP-01 Applying requires a verified email: /apply redirects to /start, the code arrives by email, the wizard then opens with the email locked", async ({ page }) => {
    const email = uniqueEmail(); await page.goto("/apply?course=personnel-licensing"); await expect(page).toHaveURL(/\/start\?next=%2Fapply%3Fcourse%3Dpersonnel-licensing/);
    await page.fill("#otp-email", email); const before = readMail().length; await page.click("button:has-text('Send me a code')"); await expect(page.locator("#otp-code")).toBeVisible();
    const { code, text } = await lastCode(email, before); expect(text).toContain("/start?email="); expect(text).toContain(code);
    await page.fill("#otp-code", code === "000000" ? "111111" : "000000"); await page.click("button:has-text('Confirm and continue')"); await expect(page.locator("#otp-err")).toContainText(/not correct|expired/i);
    await page.fill("#otp-code", code); await page.click("button:has-text('Confirm and continue')"); await page.waitForURL(/\/apply\?course=personnel-licensing/);
    await page.waitForSelector("#f-course"); await expect(page.locator("#f-course")).toHaveValue("personnel-licensing");
    await page.locator("input[name=branch]").first().check(); await page.click("button:has-text('Continue')"); await page.waitForSelector("#f-fullName");
    await expect(page.locator("#f-email")).toHaveValue(email); await expect(page.locator("#f-email")).toBeDisabled();
    // the code is single use
    const r = await page.request.post("/api/otp/verify", { data: { email, code } }); expect(r.status()).toBe(400);
  });
  test("OTP-02 Magic link from the email pre-fills the code; open redirects are refused", async ({ page, request }) => {
    const email = uniqueEmail(); const before = readMail().length; await request.post("/api/otp/request", { data: { email } }); const { code } = await lastCode(email, before);
    await page.goto(`/start?email=${encodeURIComponent(email)}&code=${code}&next=//evil.example`); await expect(page.locator("#otp-code")).toHaveValue(code);
    await page.click("button:has-text('Confirm and continue')"); await page.waitForURL("**/me"); expect(page.url()).not.toContain("evil");
  });
  test("OTP-03 Abuse controls: wrong codes lock after 5 tries, sending is rate limited per email, submitting without verification is refused", async ({ request, browser }) => {
    const email = uniqueEmail(); const before = readMail().length; await request.post("/api/otp/request", { data: { email } }); const { code } = await lastCode(email, before); const wrong = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) expect((await request.post("/api/otp/verify", { data: { email, code: wrong } })).status()).toBe(400);
    expect((await request.post("/api/otp/verify", { data: { email, code } })).status(), "correct code refused after 5 wrong tries").toBe(400);
    const e2 = uniqueEmail(); const codes: number[] = []; for (let i = 0; i < 7; i++) codes.push((await request.post("/api/otp/request", { data: { email: e2 } })).status()); expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]); expect(codes[5]).toBe(429);
    expect((await request.post("/api/otp/request", { data: { email: "not-an-email" } })).status()).toBe(400);
    const anon = await browser.newContext(); const s = await anon.request.post("/api/apply/submit", { data: { token: "x" } }); expect(s.status()).toBe(401); await anon.close();
  });
  test("DASH-01 Applicant dashboard shows the whole process: progress, documents (upload and download), invoices and activity; nobody else's data", async ({ page, browser }) => {
    await db.programme.update({ where: { slug: "personnel-licensing" }, data: { registrationFeeRwf: 25000 } });
    const email = uniqueEmail(); const a = await apiApply(page.request, { email, fullName: "Dash Board QA" }); expect(a.body.ok, JSON.stringify(a.body)).toBe(true); const ref = a.body.reference as string;
    await page.goto("/me"); await expect(page.locator(".hero h1")).toContainText("Dash"); await expect(page.locator(".hero")).toContainText(email);
    await expect(page.locator(".panel", { has: page.locator(".steps") }).filter({ hasText: ref })).toContainText("Personnel"); await expect(page.locator(".steps li")).toHaveCount(5); await expect(page.locator(".steps li.now")).toContainText("Submitted");
    await page.getByRole("tab", { name: "Documents" }).click(); await expect(page.locator("tbody tr")).toHaveCount(3);
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.locator("tbody tr").first().getByRole("button", { name: /Upload|Replace/ }).click()]); await fc.setFiles(FIX("id.jpg"));
    await expect(page.locator(".toast")).toContainText("Uploaded"); await expect(page.locator("tbody tr").first().locator("a")).toContainText("id.jpg");
    const href = await page.locator("tbody tr").first().locator("a").getAttribute("href"); const dl = await page.request.get(href!); expect(dl.status()).toBe(200); expect(dl.headers()["content-disposition"]).toContain("attachment");
    const other = await browser.newContext(); await signIn(other.request, uniqueEmail()); expect((await other.request.get(href!)).status(), "another applicant must not read this file").toBe(404); expect((await (await browser.newContext()).request.get(href!)).status()).toBe(403);
    await page.getByRole("tab", { name: "Payments" }).click(); await expect(page.locator("tbody tr").first()).toContainText("INV-"); await expect(page.locator("tbody tr").first()).toContainText("Awaiting");
    await page.getByRole("tab", { name: "Activity" }).click(); await expect(page.locator("tbody")).toContainText("submitted");
    await page.getByRole("tab", { name: "Profile" }).click(); await expect(page.locator("main")).toContainText("Dash Board QA");
    const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download my applications/ }).click()]); expect(d.suggestedFilename()).toBe("my-applications.csv");
    const p2 = await other.newPage(); await p2.goto("/me"); await expect(p2.locator("main")).not.toContainText(ref); await expect(p2.locator("main")).toContainText("not applied yet"); await other.close();
    await page.locator("#main").getByRole("button", { name: "Sign out" }).click(); await page.waitForURL("**/start"); await page.goto("/me"); await expect(page).toHaveURL(/\/start/);
    expect(await db.applicant.count({ where: { email, emailVerifiedAt: { not: null } } })).toBe(1);
  });
  test("DASH-02 Status changes made by staff show on the applicant's dashboard", async ({ page, browser }) => {
    const email = uniqueEmail(); const a = await apiApply(page.request, { email }); const ref = a.body.reference as string; const rec = await db.applicant.findFirstOrThrow({ where: { reference: ref } });
    await db.applicant.update({ where: { id: rec.id }, data: { status: "DOCUMENTS_VERIFIED" } }); await db.applicationEvent.create({ data: { applicantId: rec.id, type: "STATUS", actorName: "QA Officer", message: "Documents verified by QA." } });
    await page.goto("/me"); await expect(page.locator(".steps li.now")).toContainText("Documents verified"); await expect(page.locator(".panel", { has: page.locator(".steps") }).filter({ hasText: ref })).toContainText("Pay the registration fee");
    await page.getByRole("tab", { name: "Activity" }).click(); await expect(page.locator("tbody")).toContainText("Documents verified by QA.");
  });
});
