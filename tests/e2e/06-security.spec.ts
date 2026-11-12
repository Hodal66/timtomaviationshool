import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { db, loginStaff, staff, uniquePhone, FIX } from "./helpers";
import fs from "node:fs";

const STAFF_ROUTES = ["/dashboard", "/admissions", "/payments", "/certificates", "/admin/courses", "/enquiries", "/messages", "/executive", "/timetable", "/attendance"];

test.describe("Security (NFT-07, OWASP ASVS L2 selection)", () => {
  test("SEC-01 Every staff page and staff API refuses an unauthenticated visitor", async ({ request }) => {
    for (const r of STAFF_ROUTES) { const res = await request.get(r, { maxRedirects: 0 }); expect([r, res.status(), res.headers()["location"] ?? ""].join(" ")).toMatch(/ 30[78] .*\/login/); }
    const up = await db.upload.findFirst(); const ids = [up?.id ?? "none", "x"];
    for (const id of ids) expect((await request.get(`/api/documents/${id}`)).status()).toBe(403);
    expect((await request.get("/api/export?kind=applications")).status()).toBeGreaterThanOrEqual(300);
  });
  test("SEC-02 Forged, tampered, unsigned and expired session cookies are rejected", async ({ browser }) => {
    const mk = async (jwt: string) => { const c = await browser.newContext(); await c.addCookies([{ name: "tas_session", value: jwt, url: "http://localhost:3100" }]); const r = await c.request.get("/dashboard", { maxRedirects: 0 }); await c.close(); return r.status(); };
    const forged = await new SignJWT({ uid: "x", name: "Mallory", role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode("wrong-secret"));
    expect(await mk(forged)).toBe(307);
    const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ uid: "x", role: "ADMIN" })).toString("base64url") + ".";
    expect(await mk(none)).toBe(307); expect(await mk("garbage")).toBe(307);
    const expired = await new SignJWT({ uid: "x", name: "Old", role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(new TextEncoder().encode("qa-only-secret-not-for-production-0123456789abcdef"));
    expect(await mk(expired)).toBe(307);
  });
  test("SEC-03 Session cookie flags and logout", async ({ page, context }) => {
    await loginStaff(page); const c = (await context.cookies()).find((x) => x.name === "tas_session")!;
    expect([c.httpOnly, c.sameSite]).toEqual([true, "Lax"]);
    test.info().annotations.push({ type: "note", description: `Secure flag=${c.secure} (false on http://localhost; must be verified on HTTPS production), expires=${c.expires}` });
    await page.click("button:has-text('Sign out')"); await page.waitForURL(/login/); await page.goto("/dashboard"); await expect(page).toHaveURL(/login/);
  });
  test("SEC-04 Role-based access: non-authorised roles cannot read protected data or act", async ({ browser }) => {
    const checks: [string, string, string][] = [["LECTURER", "/payments", "Raise"], ["LECTURER", "/admissions", "TAS-"], ["ACADEMIC", "/admissions", "TAS-"], ["MARKETING", "/payments", "INV-"], ["LECTURER", "/certificates", "TAS-"], ["LECTURER", "/admin/courses", "Create draft"]];
    const out: string[] = [];
    for (const [role, path, marker] of checks) {
      const w = await staff(role as never); const ctx = await browser.newContext(); const p = await ctx.newPage(); await loginStaff(p, w);
      const res = await p.goto(path); const body = await p.locator("main").innerText().catch(() => ""); const leaked = p.url().includes(path) && body.includes(marker) && (await p.locator("main .card, main table tr").count()) > 1;
      out.push(`${role} ${path} -> ${res?.status()} ${p.url().replace(/^.*localhost:3100/, "")} ${leaked ? "DATA VISIBLE" : "no data"}`); await ctx.close();
    }
    test.info().annotations.push({ type: "matrix", description: out.join(" | ") });
    expect(out.filter((l) => l.includes("DATA VISIBLE")), out.join("\n")).toEqual([]);
  });
  test("SEC-05 Applicant documents and assets: IDs are unguessable and staff-only; tracking needs reference AND contact", async ({ request }) => {
    const up = await db.upload.findFirst({ where: { applicantId: { not: null } } }); if (up) { expect(up.id.length).toBeGreaterThanOrEqual(20); expect((await request.get(`/api/documents/${up.id}`)).status()).toBe(403); }
    const a = await db.applicant.findFirstOrThrow(); const r1 = await request.post("/api/track", { data: { reference: a.reference, contact: "nobody@example.com" } });
    expect(await r1.text()).not.toContain(a.fullName);
    const r2 = await request.post("/api/track", { data: { reference: "TAS-0000-AAAAA", contact: a.email ?? a.phone } }); expect(await r2.text()).not.toContain(a.fullName);
  });
  test("SEC-06 Injection: SQLi and XSS payloads in forms are stored inert and never executed", async ({ page, request, browser }) => {
    const xss = `<img src=x onerror="window.__xss=1">"><script>window.__xss=1</script>`; const sqli = `Robert'); DROP TABLE "Applicant";--`;
    const phone = uniquePhone();
    const slug = (await db.programme.findFirstOrThrow({ where: { status: "PUBLISHED", slug: { not: null } } })).slug!; const branch = (await db.branch.findFirstOrThrow()).id;
    const start = await page.goto("/apply?course=" + slug).then(() => page.locator("#f-start option").evaluateAll((o) => (o as HTMLOptionElement[]).map((x) => x.value).filter(Boolean)[0]));
    const dr = await (await request.post("/api/apply/draft", { data: { step: 5, data: { course: slug, fullName: xss, email: "", phone, dob: "2000-01-01", branch, start, session: "WEEKDAY", educationLevel: "A-level", institution: sqli, completionYear: "2020" } } })).json();
    const res = await request.post("/api/apply/submit", { data: { token: dr.token } }); const SKIP = { data: { course: (await db.programme.findFirstOrThrow({ where: { status: "PUBLISHED", slug: { not: null } } })).slug, fullName: xss, email: "", phone, dob: "2000-01-01", branch: (await db.branch.findFirstOrThrow()).id, start: "", session: "WEEKDAY", educationLevel: "A-level", institution: sqli, completionYear: "2020", consent: true } };
    test.info().annotations.push({ type: "note", description: `submit status ${res.status()} ${(await res.text()).slice(0, 120)}` });
    void SKIP; expect(((await res.json()) as { ok?: boolean }).ok, "XSS/SQLi-laden application accepted and stored").toBe(true);
    await loginStaff(page); await page.goto("/admissions?q=" + encodeURIComponent(sqli)); expect(await page.evaluate(() => (window as never as { __xss?: number }).__xss)).toBeUndefined();
    const a = await db.applicant.findFirst({ where: { phone: { contains: phone.slice(-9) } } });
    if (a) { await page.goto(`/admissions/${a.id}`); expect(await page.evaluate(() => (window as never as { __xss?: number }).__xss)).toBeUndefined(); expect(await page.locator("main script").count()).toBe(0); }
    for (const url of ["/courses?q=" + encodeURIComponent(sqli), "/courses/" + encodeURIComponent(`' OR 1=1--`), "/track?ref=" + encodeURIComponent(xss), `/verify?code=${encodeURIComponent(sqli)}`]) { const r = await request.get(url); expect(r.status(), url).toBeLessThan(500); expect(await r.text()).not.toContain("<script>window.__xss"); }
    expect(await db.applicant.count()).toBeGreaterThan(0);
    const ctx = await browser.newContext(); const p = await ctx.newPage(); await p.goto("/login"); await p.fill("#email", `' OR '1'='1`); await p.fill("#password", `' OR '1'='1`); await p.click("button[type=submit]"); await p.waitForTimeout(800); await expect(p).toHaveURL(/login/); await ctx.close();
  });
  test("SEC-07 Uploads cannot be attached to someone else's application or draft; stored files are served inert", async ({ request }) => {
    const png = fs.readFileSync(FIX("photo.png")); const mk = (extra: Record<string, string>) => ({ multipart: { kind: "Passport-size photo", ...extra, file: { name: "../../evil.png", mimeType: "image/png", buffer: png } } });
    expect((await request.post("/api/apply/upload", mk({ token: "no-such-draft" }))).status()).toBe(404);
    const a = await db.applicant.findFirstOrThrow({ where: { email: { not: null } } });
    expect((await request.post("/api/apply/upload", mk({ reference: a.reference!, who: "attacker@example.com" }))).status()).toBe(403);
    const d = await (await request.post("/api/apply/draft", { data: { data: {}, step: 0 } })).json();
    const ok = await request.post("/api/apply/upload", mk({ token: d.token })); expect(ok.status()).toBe(200); expect((await ok.json()).filename).not.toContain("/");
    const up = await db.upload.findFirstOrThrow({ where: { draft: { token: d.token } } }); expect(up.filename).not.toMatch(/[\\/]/);
  });
  test("SEC-08 Security headers on public and staff pages", async ({ request }) => {
    const missing: string[] = [];
    for (const path of ["/", "/courses", "/login", "/apply"]) { const h = (await request.get(path)).headers();
      for (const k of ["content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "strict-transport-security", "permissions-policy"]) if (!h[k]) missing.push(`${path}:${k}`); }
    test.info().annotations.push({ type: "note", description: "missing: " + missing.join(", ") });
    expect(missing, "missing security headers").toEqual([]);
  });
  test("SEC-09 Rate limiting: repeated wrong passwords are locked out, and bulk API calls return 429", async ({ page, request }) => {
    await page.goto("/login"); let locked = false;
    for (let i = 0; i < 14 && !locked; i++) { await page.fill("#email", "lockout.victim@test.local"); await page.fill("#password", "wrong" + i); await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.click("button[type=submit]")]); await page.waitForLoadState("networkidle"); locked = (await page.locator(".err").innerText()).includes("Too many"); }
    expect(locked, "no lockout after 14 wrong passwords").toBe(true);
    await page.fill("#email", "lockout.victim@test.local"); await page.fill("#password", "anything"); await page.click("button[type=submit]"); await page.waitForURL(/e=2/);
    const codes: number[] = []; for (let i = 0; i < 70; i++) codes.push((await request.post("/api/track", { data: { type: "PAGE_VIEW", path: "/x" } })).status());
    expect(codes).toContain(429);
  });
  test("SEC-10 Errors do not leak internals", async ({ request }) => {
    for (const [m, u, d] of [["GET", "/api/documents/%00", null], ["POST", "/api/apply/submit", "{bad json"], ["POST", "/api/track", "{"], ["GET", "/courses/%E0%A4%A", null]] as const) {
      const r = await request.fetch(u, { method: m, data: d ?? undefined, headers: { "content-type": "application/json" } }); const t = await r.text();
      expect(r.status(), u).toBeLessThan(500); expect(t, u).not.toMatch(/prisma|stack|at \w+ \(|node_modules|postgres(ql)?:\/\//i);
    }
    expect((await request.get("/api/health")).headers()["x-powered-by"]).toBeUndefined();
  });
});
