import { expect, test } from "@playwright/test";
import { apiApply, db, FIX, getState, nextStart, readMail, setState, uniquePhone } from "./helpers";

const st = () => getState("apply", () => ({ ref: "", phone: "", email: "" })) as { ref: string; phone: string; email: string };

test.describe("Application journey", () => {
  test("FT-017 One central application route works without extra navigation", async ({ page }) => {
    const r = await page.goto("/apply"); expect(r?.status()).toBe(200); await expect(page.getByRole("heading", { name: "Choose your programme" })).toBeVisible(); await expect(page.locator(".prog .meta")).toContainText("Step 1 of 5");
  });
  test("FT-018 Manual selection and Apply Now from a course use the same wizard and the same programme value", async ({ page }) => {
    await page.goto("/apply"); await page.selectOption("#f-course", "air-cabin-crew"); const manual = await page.locator("#f-course").inputValue();
    await page.goto("/courses/air-cabin-crew"); await Promise.all([page.waitForURL(/\/apply\?course=/), page.locator("main a.btn", { hasText: "Apply Now" }).first().click()]); await page.waitForSelector("#f-course");
    expect(await page.locator("#f-course").inputValue()).toBe(manual); expect(await page.locator("#f-course option").count()).toBe((await db.programme.count({ where: { status: "PUBLISHED" } })) + 1);
  });
  test("FT-019 Validation: empty form, invalid email, invalid phone, missing fields, invalid dates", async ({ page }) => {
    await page.goto("/apply?course=personnel-licensing"); await page.evaluate(() => localStorage.removeItem("tas_draft")); await page.reload(); await page.waitForSelector("#f-course");
    await page.click("button:has-text('Continue')"); await expect(page.locator("#e-branch, .field .err").first()).toBeVisible();
    await page.locator("input[name=branch]").first().check(); await page.click("button:has-text('Continue')"); await page.waitForSelector("#f-fullName");
    await page.click("button:has-text('Continue')"); await expect(page.locator("#e-fullName")).toContainText("full name"); await expect(page.locator("#e-phone")).toBeVisible(); await expect(page.locator("#e-dob")).toBeVisible();
    await page.fill("#f-fullName", "X"); await page.fill("#f-email", "not-an-email"); await page.fill("#f-phone", "123"); await page.fill("#f-dob", "1900-01-01"); await page.click("button:has-text('Continue')");
    await expect(page.locator("#e-email")).toContainText("does not look right"); await expect(page.locator("#e-phone")).toContainText("too short"); await expect(page.locator("#e-dob")).toContainText("Check your date");
    await page.fill("#f-dob", "2012-01-01"); await page.waitForSelector("#f-guardianName"); await page.fill("#f-phone", "+250788000111"); await page.fill("#f-email", ""); await page.click("button:has-text('Continue')"); await expect(page.locator("#e-guardianName")).toBeVisible();
    await expect(page.locator(".prog .meta")).toContainText("Step 2 of 5");
  });
  test("FT-020 Valid application through the UI creates exactly one correct record (with FT-022, FT-023, FT-024, FT-025)", async ({ page }) => {
    const phone = uniquePhone(), email = `qa.${Date.now()}@example.com`; setState("apply", { phone, email }); const start = await nextStart(page);
    await page.goto("/courses/personnel-licensing?utm_source=facebook&utm_medium=social&utm_campaign=qa-campaign", { waitUntil: "networkidle" });
    await Promise.all([page.waitForURL(/\/apply/), page.locator("main a.btn", { hasText: "Apply Now" }).first().click()]); await page.waitForSelector("#f-course");
    await page.evaluate(() => localStorage.removeItem("tas_draft")); await page.reload(); await page.waitForSelector("#f-course");
    await page.locator("input[name=branch]").nth(0).check(); await page.check("input[name=session][value=WEEKEND]"); await page.click("button:has-text('Continue')");
    await page.fill("#f-fullName", "QA Applicant One"); await page.fill("#f-phone", phone); await page.fill("#f-email", email); await page.fill("#f-dob", "2003-04-09"); await page.click("button:has-text('Continue')");
    await page.selectOption("#f-educationLevel", { index: 1 }); await page.fill("#f-institution", "QA School"); await page.fill("#f-completionYear", "2021"); await page.click("button:has-text('Continue')"); await page.waitForSelector(".upl");
    // FT-023: documents
    await page.setInputFiles("#up-National-ID-or-passport", FIX("id.jpg")); await expect(page.locator(".ur.ok")).toHaveCount(1);
    await page.setInputFiles("#up-Passport-size-photo", FIX("photo.png")); await expect(page.locator(".ur.ok")).toHaveCount(2);
    // FT-022: autosave and resume after a full reload
    await page.waitForTimeout(1200); await page.reload({ waitUntil: "networkidle" }); await expect(page.locator(".prog .meta")).toContainText("Step 4 of 5"); await expect(page.locator(".ur.ok")).toHaveCount(2);
    await page.setInputFiles("#up-A2-certificate-or-transcripts", FIX("cert.pdf")); await expect(page.locator(".ur.ok")).toHaveCount(3);
    await page.click("button:has-text('Continue')"); await page.waitForSelector(".rv-list");
    // FT-024: go back, change, return
    await page.click(".rv-list button:has-text('Change') >> nth=1"); await page.waitForSelector("#f-fullName"); await page.fill("#f-fullName", "QA Applicant Edited"); await page.click("button:has-text('Continue')"); await page.waitForSelector("#f-educationLevel");
    await page.click("button:has-text('Continue')"); await page.waitForSelector(".upl"); await page.click("button:has-text('Continue')"); await page.waitForSelector(".rv-list");
    await expect(page.locator(".rv-list")).toContainText("QA Applicant Edited"); await expect(page.locator(".rv-list")).toContainText("3 of 3 uploaded"); await expect(page.locator(".rv-list")).toContainText("Weekend");
    await expect(page.getByRole("button", { name: "Submit application" })).toBeDisabled(); await page.check("input[type=checkbox]");
    await page.screenshot({ path: "qa/evidence/FT-024-review.png" });
    await page.click("button:has-text('Submit application')"); await page.waitForSelector(".done .ref"); const ref = (await page.locator(".done .ref").innerText()).trim(); setState("apply", { ref });
    expect(ref).toMatch(/^TAS-\d{4}-[A-Z0-9]{5}$/); await page.screenshot({ path: "qa/evidence/FT-025-confirmation.png" }); expect(page.url()).toContain("/apply");
    const rows = await db.applicant.findMany({ where: { phone }, include: { branch: true, intake: true, programme: true, documents: true, uploads: true } }); expect(rows).toHaveLength(1); const a = rows[0];
    expect([a.fullName, a.status, a.session, a.programme.slug, a.intake.label, a.reference, a.educationLevel]).toEqual(["QA Applicant Edited", "SUBMITTED", "WEEKEND", "personnel-licensing", expect.stringMatching(/\d{4}/), ref, expect.any(String)]);
    expect(a.documents.every((d) => d.status === "RECEIVED")).toBe(true); expect(a.uploads).toHaveLength(3); expect([a.utmSource, a.utmMedium, a.utmCampaign]).toEqual(["facebook", "social", "qa-campaign"]);
    expect(start).toMatch(/^\d{4}-\d{2}$/); expect(await db.applicationDraft.count({ where: { data: { path: ["phone"], equals: phone } } })).toBe(0);
  });
  test("FT-021a Rapid repeated clicks on Submit create only one application", async ({ page, context }) => {
    const p2 = uniquePhone(); await page.goto("/apply?course=personnel-licensing"); await page.evaluate(() => localStorage.removeItem("tas_draft")); await page.reload(); await page.waitForSelector("#f-course");
    await page.locator("input[name=branch]").first().check(); await page.click("button:has-text('Continue')"); await page.fill("#f-fullName", "QA Double Click"); await page.fill("#f-phone", p2); await page.fill("#f-dob", "2003-01-01"); await page.click("button:has-text('Continue')");
    await page.selectOption("#f-educationLevel", { index: 1 }); await page.fill("#f-institution", "S"); await page.fill("#f-completionYear", "2020"); await page.click("button:has-text('Continue')"); await page.click("button:has-text('Continue')"); await page.waitForSelector(".rv-list"); await page.check("input[type=checkbox]");
    await context.route("**/api/apply/submit", async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); }); // slow network
    const btn = page.getByRole("button", { name: /Submit application|Submitting/ }); await btn.click(); for (let i = 0; i < 5; i++) await btn.click({ force: true, timeout: 500 }).catch(() => {});
    await page.waitForSelector(".done .ref"); await page.reload(); expect(await db.applicant.count({ where: { phone: p2 } })).toBe(1);
  });
  test("FT-021b Retrying the same submission token and double POSTs create only one application", async ({ request }) => {
    const first = await apiApply(request); expect(first.body.ok).toBe(true); const again = await request.post("/api/apply/submit", { data: { token: first.token } });
    expect(again.status()).toBe(404); const dup = await apiApply(request, { phone: first.data.phone }); expect(dup.body.ok).toBe(false);
    const phoneRace = uniquePhone(); const d = await Promise.all([apiApply(request, { phone: phoneRace }), apiApply(request, { phone: phoneRace }), apiApply(request, { phone: phoneRace })]);
    expect(await db.applicant.count({ where: { phone: phoneRace } }), "3 simultaneous submissions with the same contact details").toBe(1);
    expect(d.filter((x) => x.body.ok).length).toBe(1);
  });
  test("FT-023 Document upload: oversized, unsupported, corrupted, empty and disguised files are rejected safely", async ({ request }) => {
    const d = await request.post("/api/apply/draft", { data: { data: { course: "personnel-licensing" }, step: 3 } }); const { token } = await d.json();
    const up = (name: string, mime: string, buf: Buffer) => request.post("/api/apply/upload", { multipart: { token, kind: "National ID or passport", file: { name, mimeType: mime, buffer: buf } } });
    const fs = await import("node:fs"); const f = (n: string) => fs.readFileSync(FIX(n));
    expect((await up("id.jpg", "image/jpeg", f("id.jpg"))).status()).toBe(200); expect((await up("cert.pdf", "application/pdf", f("cert.pdf"))).status()).toBe(200); expect((await up("photo.png", "image/png", f("photo.png"))).status()).toBe(200);
    expect((await up("huge.pdf", "application/pdf", f("huge.pdf"))).status(), "over 4 MB").toBe(413);
    expect((await up("empty.pdf", "application/pdf", f("empty.pdf"))).status(), "empty").toBe(400);
    expect((await up("x.html", "text/html", f("script.html"))).status(), "html").toBe(415); expect((await up("x.exe", "application/octet-stream", Buffer.from("MZ"))).status(), "exe").toBe(415);
    expect((await up("fake.pdf", "application/pdf", f("fake.pdf"))).status(), "text renamed to pdf").toBe(415); expect((await up("bad.jpg", "image/jpeg", Buffer.from("not a jpeg at all"))).status(), "fake jpeg").toBe(415);
    expect((await up("script.jpg", "image/jpeg", f("script.html"))).status(), "html renamed to jpg").toBe(415);
    const unknown = await request.post("/api/apply/upload", { multipart: { token: "nope", kind: "National ID or passport", file: { name: "id.jpg", mimeType: "image/jpeg", buffer: f("id.jpg") } } }); expect(unknown.status()).toBe(404);
    const badKind = await request.post("/api/apply/upload", { multipart: { token, kind: "Something else", file: { name: "id.jpg", mimeType: "image/jpeg", buffer: f("id.jpg") } } }); expect(badKind.status()).toBe(400);
    const dr = await db.applicationDraft.findUniqueOrThrow({ where: { token }, include: { uploads: true } }); expect(dr.uploads.filter((u) => u.kind === "National ID or passport")).toHaveLength(1);
  });
  test("FT-025b Confirmation survives a refresh and the reference works for tracking", async ({ page }) => { const { ref, phone, email } = st(); void email;
    await page.goto(`/track?ref=${ref}&who=${encodeURIComponent(phone)}`); await expect(page.locator(".panel2")).toContainText("Personnel Licensing"); await expect(page.locator(".panel2")).toContainText("Submitted");
  });
  test("FT-026 The application appears in the admissions dashboard with programme, applicant, intake, branch, source and submission details", async ({ page }) => { const { ref, phone, email } = st(); void email;
    const { loginStaff } = await import("./helpers"); await loginStaff(page); await page.goto("/admissions?q=" + ref); const card = page.locator(".card", { hasText: ref }); await expect(card).toBeVisible();
    await expect(card).toContainText("QA Applicant Edited"); await expect(card).toContainText("Personnel Licensing"); await expect(card).toContainText("Weekend"); await expect(card).toContainText("Docs 0/3");
    const a = await db.applicant.findUniqueOrThrow({ where: { reference: ref } }); await page.goto(`/admissions/${a.id}`);
    const t = await page.locator("main").innerText(); for (const x of [ref, "facebook", "qa-campaign", phone, email, "QA School"]) expect(t).toContain(x);
    await page.screenshot({ path: "qa/evidence/FT-026-admissions-record.png", fullPage: true });
  });
  test("FT-027 Staff status changes reach the applicant, with email and WhatsApp messages", async ({ page }) => { const { ref, phone, email } = st(); void email;
    const { loginStaff } = await import("./helpers"); await loginStaff(page); const a = await db.applicant.findUniqueOrThrow({ where: { reference: ref } });
    await db.documentItem.updateMany({ where: { applicantId: a.id }, data: { status: "VERIFIED" } }); await page.goto("/admissions?q=" + ref);
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.locator(".card", { hasText: ref }).getByRole("button", { name: "Next stage" }).click()]); await page.waitForTimeout(800);
    expect((await db.applicant.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("DOCUMENTS_VERIFIED");
    await page.goto(`/track?ref=${ref}&who=${encodeURIComponent(phone)}`); await expect(page.locator(".panel2")).toContainText("Documents verified"); await expect(page.locator(".panel2")).toContainText("Next:");
    expect(readMail().some((m) => m.rcpt.join().includes(email) && /documents are verified/i.test(m.text))).toBe(true);
    expect(await db.notification.count({ where: { applicantId: a.id, channel: "WHATSAPP", template: "status_documents_verified" } })).toBe(1);
  });
  test("FT-028 Applicants cannot reach other applicants' records", async ({ request, page }) => { const { ref, phone, email } = st(); void email;
    const other = await db.applicant.findFirstOrThrow({ where: { reference: { not: null }, NOT: { reference: ref } } });
    expect((await request.get(`/track?ref=${other.reference}&who=${encodeURIComponent("+250000000000")}`)).status()).toBe(200);
    await page.goto(`/track?ref=${other.reference}&who=wrong@example.com`); await expect(page.locator("form")).toContainText("No application matches"); await expect(page.locator("body")).not.toContainText(other.fullName);
    await page.goto(`/track?ref=${other.reference}&who=${encodeURIComponent(phone)}`); await expect(page.locator("body")).not.toContainText(other.fullName);
    const up = await request.post("/api/apply/upload", { multipart: { reference: other.reference!, who: phone, kind: "National ID or passport", file: { name: "id.jpg", mimeType: "image/jpeg", buffer: (await import("node:fs")).readFileSync(FIX("id.jpg")) } } }); expect(up.status()).toBe(403);
    expect((await request.get(`/api/documents/${(await db.upload.findFirstOrThrow()).id}`)).status()).toBe(403); expect((await request.get(`/admissions/${other.id}`, { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300);
  });
});
