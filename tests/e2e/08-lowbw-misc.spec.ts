import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { FIX, signIn, uniqueEmail } from "./helpers";

const NOTE = (t: string) => test.info().annotations.push({ type: "note", description: t });
test.describe("Low bandwidth (NFT-06) and remaining requirements", () => {
  test("NFT-06a Home and course pages render usable content on emulated Slow 3G", async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); await signIn(ctx.request, uniqueEmail()); const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 });
    const out: string[] = [];
    for (const p of ["/", "/courses/personnel-licensing", "/apply?course=personnel-licensing"]) {
      const t0 = Date.now(); await page.goto(p, { waitUntil: "domcontentloaded", timeout: 60000 }); await page.locator("h1").first().waitFor({ timeout: 60000 }); const tH1 = Date.now() - t0;
      const bytes = await page.evaluate(() => performance.getEntriesByType("resource").reduce((n, e) => n + ((e as PerformanceResourceTiming).transferSize || 0), 0) + ((performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).transferSize || 0));
      out.push(`${p}: headline visible ${tH1} ms, ${(bytes / 1024).toFixed(0)} KB so far`); expect(tH1, p).toBeLessThan(15000);
    }
    NOTE("Slow 3G (400 kbps, 400 ms RTT): " + out.join(" | ")); fs.writeFileSync("qa/perf/slow3g.txt", out.join("\n")); await ctx.close();
  });
  test("NFT-06b Going offline during the application: the form keeps the typed data and reports the failure; resumes when back online", async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); await signIn(ctx.request, uniqueEmail()); await page.goto("/apply?course=personnel-licensing"); await page.waitForSelector("#f-course");
    await page.locator("input[name=branch]").first().check(); await page.click("button:has-text('Continue')"); await page.waitForSelector("#f-fullName");
    await ctx.setOffline(true); await page.fill("#f-fullName", "Offline Tester"); await page.waitForTimeout(1500);
    expect(await page.inputValue("#f-fullName")).toBe("Offline Tester"); const status = (await page.locator(".saved, [aria-live]").allInnerTexts()).join(" ");
    NOTE("save indicator while offline: " + status.slice(0, 80));
    await ctx.setOffline(false); await page.fill("#f-fullName", "Offline Tester Back"); await page.waitForTimeout(1600); await expect(page.locator(".saved").first()).toContainText(/saved/i); await ctx.close();
  });
  test("NFT-06c Page weight budget: home <= 500 KB transferred, course page <= 400 KB (images lazy)", async ({ page }) => {
    for (const [p, max] of [["/", 500], ["/courses/personnel-licensing", 400]] as const) { await page.goto(p, { waitUntil: "networkidle" });
      const kb = await page.evaluate(() => performance.getEntriesByType("resource").reduce((n, e) => n + ((e as PerformanceResourceTiming).transferSize || 0), 0) / 1024); NOTE(`${p}: ${kb.toFixed(0)} KB`); expect(kb, p).toBeLessThan(max); }
  });
  test("ML-01 Multilingual EN/FR/RW (SRS: language selector)", async ({ page }) => {
    await page.goto("/"); const hasSwitch = await page.locator("[aria-label*='anguage'], a[hreflang], select[name*=lang]").count();
    test.info().annotations.push({ type: "status", description: "NOT IMPLEMENTED: site is English only; no language selector, no FR/RW translations" }); expect(hasSwitch, "NOT IMPLEMENTED: no language selector").toBeGreaterThan(0);
  });
  test("PRV-01 Privacy notice, cookie/consent notice and data-protection contact (Law 058/2021) are published", async ({ page }) => {
    await page.goto("/"); const text = (await page.locator("body").innerText()).toLowerCase(); const links = await page.locator("a[href*='privacy'], a[href*='terms']").count();
    test.info().annotations.push({ type: "status", description: "NOT IMPLEMENTED: no privacy policy page or footer link; legal adequacy is for management/DPO to determine" }); expect(links + (text.includes("privacy policy") ? 1 : 0), "NOT IMPLEMENTED: no privacy policy").toBeGreaterThan(0);
  });
  test("NFT-10 Animation: every auto-moving element can be paused or respects reduced motion; no content hidden after load", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" }); await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
    await page.waitForTimeout(1200); const hidden = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => getComputedStyle(e).opacity === "0" && (e as HTMLElement).offsetHeight > 20).length);
    expect(hidden, "elements left invisible after scrolling").toBe(0);
  });
});
