import { test, expect } from "@playwright/test";
import { db, loginStaff, staff, apiApply, uniqueEmail } from "./helpers";

test.describe("Finance core (FIN-01, FIN-02 interim, FIN-03, FIN-04, FIN-05)", () => {
  test("FIN-E2E Tuition is invoiced on admission; the applicant picks installments, reports a payment; Finance matches the statement; balances agree on both dashboards", async ({ page, browser }) => {
    await db.programme.update({ where: { slug: "personnel-licensing" }, data: { feeRwf: 300000, registrationFeeRwf: 0, entryRequirements: [] } });
    const email = uniqueEmail(); const a = await apiApply(page.request, { email, fullName: "Tuition Payer" }); const ref = a.body.reference as string; const rec = await db.applicant.findFirstOrThrow({ where: { reference: ref } });
    await db.documentItem.updateMany({ where: { applicantId: rec.id }, data: { status: "VERIFIED" } }); await db.invoice.updateMany({ where: { applicantId: rec.id }, data: { status: "PAID" } }); await db.applicant.update({ where: { id: rec.id }, data: { status: "REGISTRATION_PAID" } });
    const sctx = await browser.newContext(); const sp = await sctx.newPage(); await loginStaff(sp, await staff("FINANCE")); const actx = await browser.newContext(); const ap = await actx.newPage(); await loginStaff(ap);
    await ap.goto(`/admissions?view=board&q=${ref}`); await Promise.all([ap.waitForResponse((r) => r.request().method() === "POST"), ap.locator(".card").getByRole("button", { name: "Next stage" }).click()]);
    await expect.poll(async () => db.invoice.count({ where: { applicantId: rec.id, kind: "TUITION" } })).toBe(1);
    await page.goto("/me"); await page.getByRole("tab", { name: "Payments" }).click(); await expect(page.locator(".kpi", { hasText: "Balance" })).toContainText("RWF 300,000");
    await page.getByRole("button", { name: "3 installments" }).click(); await expect(page.locator(".toast")).toContainText("plan was updated"); await expect(page.locator("tbody tr")).toHaveCount(3); await expect(page.locator("tbody tr").first()).toContainText("RWF 100,000");
    const tx = "MP" + Date.now(); await page.locator("tbody tr").first().getByRole("button", { name: "I have paid" }).click(); await page.fill("#pay-ref", tx); await page.getByRole("button", { name: "Send to Finance" }).click(); await expect(page.locator(".toast")).toContainText("Finance will confirm");
    await expect(page.locator("tbody tr").first()).toContainText("being checked"); await expect(page.locator(".kpi", { hasText: "Balance" })).toContainText("RWF 300,000");
    await expect(page.getByRole("button", { name: "One payment" }), "the plan is locked once a payment is reported").toHaveCount(0); expect((await page.request.post("/api/me/plan", { data: { applicantId: rec.id, installments: 1 } })).status()).toBe(400);
    await sp.goto("/payments"); await expect(sp.locator(".panel", { hasText: "Payments reported by applicants" })).toContainText(tx);
    await sp.fill("textarea[name=lines]", `reference,amount\n${tx},100000`); await sp.getByRole("button", { name: "Match statement" }).click(); await expect(sp.locator("[role=status]")).toContainText("1 matched and confirmed");
    await page.reload(); await page.getByRole("tab", { name: "Payments" }).click(); await expect(page.locator(".kpi", { hasText: "Balance" })).toContainText("RWF 200,000"); await expect(page.locator(".kpi", { hasText: /^Paid/ })).toContainText("RWF 100,000");
    // Finance records a part payment in dollars on the second installment
    await sp.goto("/payments"); await sp.locator("form", { has: sp.locator("input[name=rate]") }).first().locator("input[name=rate]").fill("1400"); await sp.locator("form", { has: sp.locator("input[value=USD]") }).getByRole("button", { name: "Save" }).click(); await expect(sp.locator("[role=status]")).toContainText("USD rate saved");
    await sp.locator(".dt-search input").first().fill(`TUI-${ref}-2`); const row = sp.locator("tbody tr", { hasText: `TUI-${ref}-2` }); await row.locator("input[name=amount]").fill("50"); await row.locator("select[name=currency]").selectOption("USD"); await row.locator("input[name=reference]").fill("USD" + Date.now()); await row.getByRole("button", { name: "Mark verified" }).click();
    await expect.poll(async () => (await db.payment.findFirst({ where: { invoice: { reference: `TUI-${ref}-2` } } }))?.valueRwf).toBe(70000);
    await page.reload(); await page.getByRole("tab", { name: "Payments" }).click(); await expect(page.locator(".kpi", { hasText: "Balance" })).toContainText("RWF 130,000");
    const lect = await browser.newContext(); const lp = await lect.newPage(); await loginStaff(lp, await staff("ADMISSIONS")); await lp.goto("/payments"); await expect(lp.locator("textarea[name=lines]"), "only Finance can match statements").toHaveCount(0); await lect.close(); await sctx.close(); await actx.close();
    await db.programme.update({ where: { slug: "personnel-licensing" }, data: { feeRwf: 300000 } });
  });
  test("FIN-CRON The reminder job refuses callers without the secret", async ({ request }) => { expect((await request.get("/api/cron/reminders")).status()).toBe(403); expect((await request.get("/api/cron/reminders", { headers: { authorization: "Bearer guess" } })).status()).toBe(403); });
});
