import { expect, test } from "@playwright/test";
import { areaOf } from "../../src/lib/areas";
import { blocked, db, notImplemented, scrollAll } from "./helpers";

test.describe("Course catalogue", () => {
  test("FT-006 Catalogue shows exactly the published programmes from the database", async ({ page }) => {
    await page.goto("/courses", { waitUntil: "networkidle" }); const shown = await page.locator(".cc h3").allInnerTexts();
    const db_ = await db.programme.findMany({ where: { status: "PUBLISHED" }, select: { name: true } });
    expect(shown.length).toBe(db_.length); expect([...shown].sort()).toEqual(db_.map((p) => p.name).sort());
    await expect(page.locator(".count")).toHaveText(`${db_.length} programmes`);
  });
  test("FT-008a Category filters return exactly the matching programmes", async ({ page }) => {
    await page.goto("/courses", { waitUntil: "networkidle" }); const all = await db.programme.findMany({ where: { status: "PUBLISHED" } });
    const chips = await page.locator(".chip").allInnerTexts(); expect(chips.length).toBeGreaterThan(5);
    for (const chip of await page.locator(".chip").all()) { const label = (await chip.innerText()).replace(/\d+$/, "").trim(); await chip.click(); const n = await page.locator(".cc").count();
      const expected = label === "All" ? all.length : all.filter((p) => areaOf(p) && (({ "Aviation Management": "aviation-management", "Airline and Airport Management": "airport-airline", "Airport Operations": "airport-ops", "Aviation Safety and Security": "safety-security", "Air Cargo Management": "cargo", "Air Cabin Crew": "cabin-crew", "Air Fares and Ticketing": "ticketing", "Travel and Tourism Management": "tourism", "IATA and other approved professional programmes": "professional", "Approved ICT and technology programmes": "ict" } as Record<string, string>)[label] === areaOf(p))).length;
      expect(n, label).toBe(expected); }
  });
  test("FT-008b A category with no approved programme is not offered as a filter", async ({ page }) => {
    await page.goto("/courses"); const chips = (await page.locator(".chip").allInnerTexts()).join("|"); expect(chips).not.toContain("Flight Dispatch");
    expect(await db.programme.count({ where: { visualTheme: "dispatch", status: "PUBLISHED" } })).toBe(0);
  });
  test("FT-008c Filters by delivery mode, duration, branch and intake (SRS 14.1)", async () => { notImplemented("Only subject area and text search exist. SRS 14.1 also asks for filters by type, duration, fee, session and branch."); });
  test("FT-009 Search: full name, part of a name, no match, upper and lower case, special characters", async ({ page }) => {
    await page.goto("/courses", { waitUntil: "networkidle" });
    await page.fill("#cq", "Personnel Licensing"); await expect(page.locator(".cc h3").first()).toHaveText("Personnel Licensing");
    await page.fill("#cq", "licens"); expect(await page.locator(".cc").count()).toBeGreaterThanOrEqual(1);
    await page.fill("#cq", "CABIN"); const up = await page.locator(".cc").count(); await page.fill("#cq", "cabin"); expect(await page.locator(".cc").count()).toBe(up); expect(up).toBeGreaterThanOrEqual(2);
    await page.fill("#cq", "zzzzqq"); await expect(page.locator(".empty")).toContainText("No programmes match"); await page.getByRole("button", { name: "Clear search" }).click(); await expect(page.locator(".cc").first()).toBeVisible();
    for (const q of ["<script>alert(1)</script>", "'; DROP TABLE \"Programme\"; --", "%", "\\", "ui/ux"]) { await page.fill("#cq", q); await page.waitForTimeout(100); await expect(page.locator("body")).not.toContainText("Application error"); }
    expect(await db.programme.count()).toBeGreaterThan(30);
  });
  test("FT-010 Programme details on the page equal the database record", async ({ page }) => {
    const rows = await db.programme.findMany({ where: { status: "PUBLISHED" } });
    for (const p of rows) { await page.goto(`/courses/${p.slug}`); const t = await page.locator("main").innerText();
      expect(await page.locator("h1").innerText()).toBe(p.name);
      if (p.feeRwf != null) expect(t).toContain(`RWF ${p.feeRwf.toLocaleString("en-US")}`); else expect(t).not.toMatch(/Tuition is RWF/);
      if (p.durationMonths) expect(t).toContain(`${p.durationMonths} months`); else expect(t).not.toMatch(/\d+ months/);
      for (const o of p.objectives) expect(t).toContain(o); for (const r of p.entryRequirements) expect(t).toContain(r); }
  });
  test("FT-011 Every published programme has a loading, relevant, correctly sized image", async ({ page }) => {
    await page.goto("/courses", { waitUntil: "networkidle" }); await scrollAll(page); await page.waitForTimeout(800);
    const cards = page.locator(".cc"); const n = await cards.count(); let photos = 0, art = 0; const sizes = new Set<string>();
    for (let i = 0; i < n; i++) { const c = cards.nth(i); const img = c.locator(".ph img"); const hasImg = (await img.count()) > 0; const bb = await c.locator(".ph").boundingBox(); sizes.add(`${Math.round(bb!.width)}x${Math.round(bb!.height)}`);
      if (hasImg) { photos++; expect(await img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0), `image ${i}`).toBe(true); } else { art++; expect(await c.locator(".ph svg[role=img]").count(), `art ${i}`).toBe(1); } }
    expect(photos + art).toBe(n); expect(sizes.size).toBe(1);
  });
  test("FT-011b Course hero images have alternative text", async ({ page }) => {
    await page.goto("/courses/personnel-licensing", { waitUntil: "networkidle" }); const alt = await page.locator(".chero .im img").getAttribute("alt");
    expect(alt, "hero photograph alt text").toBeTruthy();
  });
  test("FT-011c Images are relevant: no single photograph is reused for more than a few unrelated programmes", async ({ page }) => {
    await page.goto("/courses", { waitUntil: "networkidle" }); await scrollAll(page); await page.waitForTimeout(800);
    const srcs = await page.locator(".cc .ph img").evaluateAll((i) => i.map((x) => { const u = new URL((x as HTMLImageElement).currentSrc); return u.searchParams.get("url") ?? u.pathname; }));
    const count: Record<string, number> = {}; srcs.forEach((s) => (count[s] = (count[s] ?? 0) + 1)); const max = Math.max(...Object.values(count));
    expect(max, JSON.stringify(count)).toBeLessThanOrEqual(5);
  });
  test("FT-012 Seats and intake changes shown on the website (CMS-02, WEB-05)", async () => { notImplemented("By decision of the product owner, registration is open all year and seats are not shown. SRS CMS-02/WEB-05 still describe live seat data; the SRS needs to be updated."); });
  test("NFT-10a Catalogue interactions respond without delay", async ({ page }) => {
    await page.goto("/courses", { waitUntil: "networkidle" }); const t0 = Date.now(); await page.fill("#cq", "air"); await page.locator(".cc").first().waitFor(); const dt = Date.now() - t0; expect(dt).toBeLessThan(500);
  });
});
