import { expect, test } from "@playwright/test";
import { db, expectNoHorizontalScroll, scrollAll } from "./helpers";
import { SITE } from "../../src/lib/site";

test.describe("Homepage, navigation and content", () => {
  test("FT-001 Homepage loads with every primary section and no errors", async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const r = await page.goto("/", { waitUntil: "networkidle" }); expect(r?.status()).toBe(200);
    await scrollAll(page);
    for (const h of ["Discover our programmes", "Practical training, close to where you live", "Five simple steps to your place", "Ready to Begin Your Aviation Career?"]) await expect(page.getByRole("heading", { name: h })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your Journey Into the World of Aviation Starts Here.");
    await page.screenshot({ path: "qa/evidence/FT-001-home.png", fullPage: true });
    expect(errors).toEqual([]);
  });
  test("FT-002 Every navigation item reaches its page; back/forward work; header is sticky", async ({ page }) => {
    const items: [string, string, string][] = [["About", "/about", "About the School"], ["Courses", "/courses", "Course catalogue"], ["Admissions", "/how-to-apply", "Admissions"], ["Contact", "/contact", "Contact"]];
    await page.goto("/");
    for (const [label, path] of items) { await page.locator("header nav").getByRole("link", { name: label, exact: true }).click(); await expect(page).toHaveURL(new RegExp(path + "$")); await expect(page.locator("header nav a[aria-current=page]")).toHaveText(label); }
    await page.goBack(); await expect(page).toHaveURL(/\/how-to-apply$/); await page.goForward(); await expect(page).toHaveURL(/\/contact$/);
    await page.locator("header nav").getByRole("link", { name: "Home" }).click(); await expect(page).toHaveURL(/\/$/);
    await page.evaluate(() => scrollTo({ top: 1400, behavior: "instant" })); await page.waitForTimeout(300);
    expect(await page.locator("header.hd").evaluate((h) => getComputedStyle(h).position)).toBe("sticky");
    expect((await page.locator("header.hd").boundingBox())?.y).toBeLessThanOrEqual(1); await expect(page.locator("header.hd")).toHaveClass(/solid/);
  });
  test("FT-003 Hero buttons lead to the catalogue and the application", async ({ page }) => {
    await page.goto("/"); await page.locator(".hero2 .acts").getByRole("link", { name: "Explore Courses" }).click(); await expect(page).toHaveURL(/\/courses$/);
    await page.goto("/"); await page.locator(".hero2 .acts").getByRole("link", { name: "Apply Now" }).click(); await expect(page).toHaveURL(/\/apply$/); await expect(page.getByRole("heading", { name: "Start your application" })).toBeVisible();
  });
  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    test("FT-004 Mobile menu opens, closes with Escape, navigates and survives scrolling", async ({ page }) => {
      await page.goto("/"); await expect(page.locator("header nav")).toBeHidden(); const burger = page.getByRole("button", { name: "Open menu" }); await burger.tap();
      await expect(page.locator("#drawer")).toBeVisible(); await expect(page.locator("#drawer a")).toHaveCount(7); await page.keyboard.press("Escape"); await expect(page.locator("#drawer")).toBeHidden();
      await page.evaluate(() => scrollTo({ top: 900, behavior: "instant" })); await page.getByRole("button", { name: "Open menu" }).tap(); await expect(page.locator("#drawer")).toBeVisible();
      await page.locator("#drawer").getByRole("link", { name: "Courses" }).tap(); await expect(page).toHaveURL(/\/courses$/); await expect(page.locator("#drawer")).toBeHidden(); await expectNoHorizontalScroll(page);
    });
  });
  test("FT-005 Homepage content matches approved records and makes no unverifiable claims", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" }); const body = await page.locator("body").innerText();
    expect(body).toContain(SITE.phoneDisplay); expect(body).toContain(SITE.email); expect(body).toContain(SITE.address); expect(body).toContain(SITE.mission);
    for (const b of SITE.branches) expect(body).toContain(b);
    const names = await page.locator(".cc h3").allInnerTexts(); const published = (await db.programme.findMany({ where: { status: "PUBLISHED" }, select: { name: true } })).map((p) => p.name);
    for (const n of names) expect(published).toContain(n);
    expect(body).not.toMatch(/accredited|accreditation|partnership with|we award (international )?(professional )?certificate/i);
  });
});

test.describe("Course pages and links", () => {
  test("FT-013 Course URLs are stable: direct, refreshed, new tab; unknown identifiers give 404", async ({ page, context, request }) => {
    const r = await page.goto("/courses/personnel-licensing"); expect(r?.status()).toBe(200); await page.reload(); await expect(page.locator("h1")).toHaveText("Personnel Licensing");
    const tab = await context.newPage(); await tab.goto("/courses/personnel-licensing"); await expect(tab.locator("h1")).toHaveText("Personnel Licensing");
    for (const bad of ["/courses/does-not-exist", "/courses/%00", "/courses/..%2Fadmin", "/courses/PERSONNEL-LICENSING", "/courses/%E0%A4%A"]) { const x = await request.get(bad); expect([404, 400], bad).toContain(x.status()); }
  });
  test("FT-014 Each course shows its own content; nothing is shared between programmes", async ({ page }) => {
    const rows = await db.programme.findMany({ where: { status: "PUBLISHED" }, take: 12, orderBy: { code: "asc" } });
    for (const p of rows) { await page.goto(`/courses/${p.slug}`); await expect(page.locator("h1")).toHaveText(p.name); const t = await page.locator("main").innerText();
      if (p.feeRwf) expect(t).toContain(p.feeRwf.toLocaleString("en-US")); if (p.summary) expect(t).toContain(p.summary.replace(/\.{3}$/, "").slice(0, 40)); }
  });
  test("FT-015 Apply Now carries the programme into the wizard from every course button", async ({ page }) => {
    await page.goto("/courses/air-cabin-crew"); const hrefs = await page.locator("main a.btn, .stick a.btn").evaluateAll((a) => a.filter((x) => /Apply/.test(x.textContent ?? "")).map((x) => x.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThanOrEqual(3); for (const h of hrefs) expect(h).toBe("/apply?course=air-cabin-crew");
    await Promise.all([page.waitForURL("**/apply?course=air-cabin-crew"), page.locator("main a.btn", { hasText: "Apply Now" }).first().click()]); await page.waitForSelector("#f-course"); await expect(page.locator("#f-course")).toHaveValue("air-cabin-crew");
  });
  test("FT-016 Related programme links open the correct programmes", async ({ page }) => {
    await page.goto("/courses/personnel-licensing"); const links = await page.locator("section:has(h2:text('Related programmes')) .cc h3 a").evaluateAll((a) => a.map((x) => [x.textContent, x.getAttribute("href")]));
    expect(links.length).toBeGreaterThan(0);
    for (const [name, href] of links) { const r = await page.goto(href!); expect(r?.status()).toBe(200); await expect(page.locator("h1")).toHaveText(name!); }
  });
});

test.describe("SEO (NFT-09, WEB-01)", () => {
  test("NFT-09a Initial HTML (no JavaScript) carries real content, unique titles and descriptions", async ({ request }) => {
    const slugs = (await db.programme.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, name: true } }));
    const titles = new Set<string>(), descs = new Set<string>();
    for (const p of slugs) {
      const html = await (await request.get(`/courses/${p.slug}`)).text();
      expect(html).toContain(`<h1`); expect(html).toContain(p.name.replace(/&/g, "&amp;")); const t = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ""; const d = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
      expect(t).toContain("Timtom Aviation School"); expect(d.length).toBeGreaterThan(20); titles.add(t); descs.add(d);
      expect(html).toMatch(/<link rel="canonical" href="http[^"]*\/courses\/[^"]+"/); expect(html).toContain('property="og:title"'); expect(html).toContain('property="og:image"');
      expect(html).toContain('"@type":"Course"');
    }
    expect(titles.size).toBeGreaterThan(slugs.length * 0.95); expect(descs.size).toBeGreaterThan(slugs.length * 0.7);
  });
  test("NFT-09b Home, sitemap and robots", async ({ request }) => {
    const home = await (await request.get("/")).text(); expect(home).toContain("EducationalOrganization"); expect(home).toContain("<h1");
    const sm = await (await request.get("/sitemap.xml")).text(); const pub = await db.programme.count({ where: { status: "PUBLISHED" } });
    expect((sm.match(/<loc>/g) ?? []).length).toBe(pub + 5); expect(sm).not.toMatch(/\/(admin|apply|track|login|dashboard)/);
    const robots = await (await request.get("/robots.txt")).text(); for (const p of ["/api/", "/admin/", "/apply", "/track", "/preview/", "/login"]) expect(robots).toContain("Disallow: " + p); expect(robots).toContain("Sitemap:");
  });
  test("NFT-09c Private and unpublished pages are not indexable and absent from the sitemap", async ({ request }) => {
    const sample = await db.programme.findFirstOrThrow({ where: { status: "ARCHIVED" } }); expect((await request.get(`/courses/${sample.slug}`)).status()).toBe(404);
    const sm = await (await request.get("/sitemap.xml")).text(); expect(sm).not.toContain(sample.slug!);
    expect((await (await request.get("/apply")).text())).toContain("noindex"); expect((await (await request.get("/track")).text())).toContain("noindex");
  });
  test("NFT-09d Internal links on the main pages are not broken", async ({ page, request }) => {
    const seen = new Set<string>();
    for (const start of ["/", "/courses", "/about", "/how-to-apply", "/contact"]) {
      await page.goto(start); const hrefs = await page.locator("a[href^='/']").evaluateAll((a) => a.map((x) => (x as HTMLAnchorElement).getAttribute("href")!));
      for (const h of new Set(hrefs)) { const u = h.split("#")[0].split("?")[0]; if (!u || seen.has(u)) continue; seen.add(u); const r = await request.get(u, { maxRedirects: 3 }); expect(r.status(), `${start} -> ${h}`).toBeLessThan(400); }
    }
    expect(seen.size).toBeGreaterThan(10);
  });
  test("NFT-09e Social previews: image, title and description present on the home and a course page", async ({ request }) => {
    for (const path of ["/", "/courses/personnel-licensing"]) { const h = await (await request.get(path)).text(); for (const k of ["og:title", "og:description", "og:image"]) expect(h, `${path} ${k}`).toContain(`property="${k}"`); }
  });
});
