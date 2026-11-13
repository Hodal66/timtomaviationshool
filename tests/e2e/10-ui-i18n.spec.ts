import { test, expect } from "@playwright/test";
import { loginStaff, staff, db, uniqueEmail, signIn, apiApply } from "./helpers";

const LANG: Record<string, { home: string; nav: string; lang: string }> = { fr: { home: "Accueil", nav: "Formations", lang: "fr" }, rw: { home: "Ahabanza", nav: "Amasomo", lang: "rw" }, sw: { home: "Mwanzo", nav: "Kozi", lang: "sw" }, en: { home: "Home", nav: "Courses", lang: "en" } };
test.describe("Languages, theme and dashboard components", () => {
  for (const [code, x] of Object.entries(LANG)) test(`I18N-${code} The whole public site follows the chosen language (${code})`, async ({ browser }) => {
    const ctx = await browser.newContext(); await ctx.addCookies([{ name: "tas_lang", value: code, url: "http://localhost:3100" }]); const p = await ctx.newPage();
    for (const path of ["/", "/about", "/how-to-apply", "/contact", "/start"]) { await p.goto(path, { waitUntil: "networkidle" }); await p.waitForTimeout(250); expect(await p.locator("html").getAttribute("lang"), path).toBe(x.lang); await expect(p.locator("header nav")).toContainText(x.nav); }
    await p.goto("/", { waitUntil: "networkidle" }); await p.waitForTimeout(300); const body = await p.locator("main").innerText();
    if (code !== "en") { const english = ["Explore Courses", "Ready to Begin Your Aviation Career?", "Five simple steps to your place"]; for (const s of english) expect(body, `${code}: still English: ${s}`).not.toContain(s); }
    await ctx.close();
  });
  test("I18N-switch The language menu changes the language, remembers it, and does not break the application form", async ({ page }) => {
    await page.goto("/"); await page.getByRole("button", { name: "Language" }).first().click(); await page.getByRole("menuitemradio", { name: "Kinyarwanda" }).click(); await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("lang", "rw"); await page.goto("/courses"); await expect(page.locator("html")).toHaveAttribute("lang", "rw"); await expect(page.locator("h1").first()).toContainText("Shaka porogaramu");
    await signIn(page.request, uniqueEmail()); await page.goto("/apply?course=personnel-licensing"); await page.waitForSelector("#f-course"); await expect(page.locator("main")).toContainText("Komeza");
  });
  test("THEME-01 Light, dark and automatic themes apply to the public site and dashboards, and persist across pages", async ({ page }) => {
    await page.goto("/"); const bg = () => page.evaluate(() => getComputedStyle((document.querySelector(".site") ?? document.body) as Element).backgroundColor);
    const light = await bg(); await page.getByRole("button", { name: "Colour theme" }).first().click(); await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); const dark = await bg(); expect(dark).not.toBe(light);
    await page.goto("/about"); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const lum = (c: string) => { const m = c.match(/\d+/g)!.map(Number); return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000; }; expect(lum(await bg())).toBeLessThan(60);
    await loginStaff(page); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); expect(lum(await bg())).toBeLessThan(60);
    await page.getByRole("button", { name: "Colour theme" }).click(); await page.getByRole("menuitemradio", { name: "Light" }).click(); await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
  test("DT-01 Data table: search, filter, sort, hide columns, pagination, page size and CSV download", async ({ page }) => {
    for (let i = 0; i < 12; i++) await apiApply(page.request, { fullName: `Table Tester ${String(i).padStart(2, "0")}` });
    await loginStaff(page); await page.goto("/admissions?view=table"); const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(10); await expect(page.locator(".dt-foot")).toContainText(/Showing 1–10 of \d+/);
    await page.getByRole("button", { name: "2", exact: true }).click(); await expect(page.locator(".dt-foot")).toContainText(/Showing 11–/);
    await page.locator(".dt-foot select").selectOption("50"); await expect(page.locator(".dt-foot")).toContainText(/Showing 1–\d+ of/);
    await page.locator(".dt-search input").fill("Table Tester 07"); await expect(rows).toHaveCount(1); await expect(rows.first()).toContainText("Table Tester 07"); await page.locator(".dt-search input").fill("");
    await page.locator("th", { hasText: "Applicant" }).click(); const asc = await page.locator("tbody tr td:nth-child(3)").allInnerTexts(); expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    await page.locator("th", { hasText: "Applicant" }).click(); const desc = await page.locator("tbody tr td:nth-child(3)").allInnerTexts(); expect(desc).toEqual([...desc].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })));
    await page.getByRole("button", { name: "Columns" }).click(); await page.locator(".dt-cols").getByLabel("Payment", { exact: true }).uncheck(); await expect(page.locator("th", { hasText: "Payment" })).toHaveCount(0); await page.locator(".dt-cols").getByLabel("Email", { exact: true }).check(); await expect(page.locator("th", { hasText: "Email" })).toHaveCount(1);
    await page.reload(); await expect(page.locator("th", { hasText: "Payment" }), "column choice is remembered").toHaveCount(0);
    await page.locator("select[aria-label=Status]").selectOption({ label: "Submitted" }); await expect(page.locator("tbody tr").first()).toContainText("Submitted");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download CSV" }).click()]); expect(dl.suggestedFilename()).toMatch(/^admissions-\d{4}-\d{2}-\d{2}\.csv$/); const txt = await (await import("node:fs")).promises.readFile(await dl.path(), "utf8"); expect(txt).toContain("Applicant"); expect(txt).not.toContain("Payment");
  });
  test("DT-02 Bulk action: stage rules still apply to a whole selection, with clear feedback", async ({ page }) => {
    const a = await apiApply(page.request, { fullName: "Bulk One" }); const b = await apiApply(page.request, { fullName: "Bulk Two" }); const ra = await db.applicant.findFirstOrThrow({ where: { reference: a.body.reference } });
    await db.documentItem.updateMany({ where: { applicantId: ra.id }, data: { status: "VERIFIED" } });
    await loginStaff(page); await page.goto("/admissions?view=table"); await page.locator(".dt-search input").fill("Bulk "); const rows = page.locator("tbody tr"); await expect(rows).toHaveCount(2);
    await page.getByLabel("Select all on this page").check(); await expect(page.locator(".bulk")).toContainText("2 selected"); await page.getByRole("button", { name: "Move to next stage" }).click();
    await expect(page.locator("[role=status].bulk")).toContainText(/1 moved.*1 blocked/);
    expect((await db.applicant.findFirstOrThrow({ where: { reference: a.body.reference } })).status).toBe("DOCUMENTS_VERIFIED"); expect((await db.applicant.findFirstOrThrow({ where: { reference: b.body.reference } })).status).toBe("SUBMITTED");
  });
  test("SHELL-01 Staff navigation shows only the modules a role may use; the menu collapses and survives reload", async ({ page, browser }) => {
    await loginStaff(page); await expect(page.locator(".ds-nav a")).toHaveCount(17); await page.getByRole("button", { name: "Collapse menu" }).click(); await expect(page.locator(".ds")).toHaveAttribute("data-collapsed", "true"); await page.reload(); await expect(page.locator(".ds")).toHaveAttribute("data-collapsed", "true");
    const ctx = await browser.newContext(); const l = await ctx.newPage(); await loginStaff(l, await staff("LECTURER")); const labels = await l.locator(".ds-nav a").allInnerTexts(); expect(labels.map((x) => x.trim())).toEqual(["Dashboard", "Assessments", "My teaching", "Timetable", "Attendance"]); await ctx.close();
  });
  test("SHELL-02 Mobile: the menu is a drawer that opens, closes with Escape and the page does not scroll sideways", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); await loginStaff(p);
    await expect(p.locator(".ds-side")).not.toBeInViewport(); await p.getByRole("button", { name: "Open menu" }).click(); await expect(p.locator(".ds-side")).toBeInViewport(); await p.keyboard.press("Escape"); await expect(p.locator(".ds-side")).not.toBeInViewport();
    for (const path of ["/dashboard", "/admissions", "/payments", "/enquiries", "/admin/courses", "/media"]) { await p.goto(path, { waitUntil: "networkidle" }); expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(0); }
    await ctx.close();
  });
});

test.describe("Staff administration and live data", () => {
  test("USERS-01 Administrator adds, re-roles, resets and deletes a staff account; others cannot see the page", async ({ page, browser }) => {
    const email = `crud.${Date.now()}@test.local`; await loginStaff(page); await page.goto("/admin/users");
    await page.fill("input[name=name]", "Crud Tester"); await page.fill("form.panel input[name=email]", email); await page.selectOption("form.panel select[name=role]", "LECTURER"); await page.fill("form.panel input[name=password]", "short"); await page.click("button:has-text('Add')");
    expect((await db.user.count({ where: { email } })), "short password refused by the browser or server").toBe(0);
    await page.fill("form.panel input[name=password]", "a-long-password-1"); await page.click("button:has-text('Add')"); await page.waitForURL(/ok=1/); expect((await db.user.findUniqueOrThrow({ where: { email } })).role).toBe("LECTURER");
    await page.locator(".dt-search input").fill(email); const row = page.locator("tbody tr"); await expect(row).toHaveCount(1); await row.locator("summary").click(); await row.getByRole("button", { name: "Finance" }).click(); await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { email } })).role).toBe("FINANCE");
    const before = (await db.user.findUniqueOrThrow({ where: { email } })).passwordHash; await page.locator(".dt-search input").fill(email); await row.locator("details").evaluate((d: HTMLDetailsElement) => { d.open = true; }); await row.locator("input[name=password]").fill("another-long-pass-2"); await row.getByRole("button", { name: "Reset password" }).click(); await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { email } })).passwordHash).not.toBe(before);
    const ctx = await browser.newContext(); const p2 = await ctx.newPage(); await p2.goto("/login"); await p2.fill("#email", email); await p2.fill("#password", "another-long-pass-2"); await p2.click("button[type=submit]"); await p2.waitForURL("**/dashboard"); await p2.goto("/admin/users"); await expect(p2).toHaveURL(/dashboard/); await ctx.close();
    await page.locator(".dt-search input").fill(email); page.once("dialog", (d) => d.accept()); await page.locator("tbody tr input[type=checkbox]").check(); await page.getByRole("button", { name: "Delete" }).click(); await expect.poll(async () => db.user.count({ where: { email } })).toBe(0);
  });
  test("LIVE-01 The staff dashboard refreshes by itself: a new application appears without reloading", async ({ page, request }) => {
    test.setTimeout(120000); await loginStaff(page); const kpi = () => page.locator(".kpi", { hasText: "New applications" }).locator("b").innerText(); const before = Number(await kpi());
    await apiApply(request, { fullName: "Live Tester" }); await expect.poll(async () => Number(await kpi()), { timeout: 75000, intervals: [3000] }).toBeGreaterThan(before);
  });
});
