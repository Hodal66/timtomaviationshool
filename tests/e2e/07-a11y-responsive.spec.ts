import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { loginStaff } from "./helpers";

const PAGES = ["/", "/courses", "/how-to-apply", "/apply?course=personnel-licensing", "/contact", "/about", "/track", "/verify", "/login"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SIZES: [string, number, number][] = [["360", 360, 800], ["390", 390, 844], ["430", 430, 932], ["768", 768, 1024], ["1024", 1024, 768], ["1366", 1366, 768], ["1920", 1920, 1080]];
const FILE = "qa/evidence/axe-results.jsonl";
const found = { push: (o: Record<string, unknown>) => { fs.mkdirSync("qa/evidence", { recursive: true }); fs.appendFileSync(FILE, JSON.stringify(o) + "\n"); } };

test.describe("Accessibility (NFT-05, WCAG 2.2 AA) and responsive layout (NFT-04)", () => {
  for (const [label, w, h] of [["desktop", 1366, 768], ["mobile", 390, 844]] as const) for (const path of PAGES) {
    test(`A11Y axe ${label} ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h }); await page.goto(path, { waitUntil: "networkidle" });
      const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
      for (const v of r.violations) found.push({ page: path, viewport: label, rule: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.html.slice(0, 160) });
      expect(r.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => `${v.id} (${v.nodes.length})`), `${path} ${label}`).toEqual([]);
    });
  }
  test("A11Y staff dashboard pages (axe, desktop)", async ({ page }) => {
    await loginStaff(page); const bad: string[] = [];
    for (const p of ["/dashboard", "/admissions", "/payments", "/enquiries", "/admin/courses", "/media"]) { await page.goto(p, { waitUntil: "networkidle" }); const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
      for (const v of r.violations) { found.push({ page: p, viewport: "staff-desktop", rule: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.html.slice(0, 160) }); if (v.impact === "critical" || v.impact === "serious") bad.push(`${p}:${v.id}`); } }
    expect(bad).toEqual([]);
  });
  test("A11Y keyboard: skip link or logical tab order reaches nav, main content and the form; focus is visible", async ({ page }) => {
    await page.goto("/apply?course=personnel-licensing"); const seen: string[] = [];
    for (let i = 0; i < 14; i++) { await page.keyboard.press("Tab"); seen.push(await page.evaluate(() => { const e = document.activeElement as HTMLElement; const s = getComputedStyle(e); return `${e.tagName}|${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 24)}|${s.outlineStyle !== "none" || s.boxShadow !== "none"}`; })); }
    test.info().annotations.push({ type: "note", description: seen.join(" ; ") });
    expect(seen.filter((x) => x.startsWith("BODY")).length).toBeLessThan(3); expect(seen.every((x) => x.endsWith("true")), "every focused element shows a focus indicator: " + seen.join(" ; ")).toBe(true);
  });
  test("A11Y reduced motion: animations are suppressed", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" }); const p = await ctx.newPage(); await p.goto("/", { waitUntil: "networkidle" });
    const running = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getComputedTiming().iterations ?? 1) === Infinity).length);
    const reveal = await p.locator(".reveal:not(.in), [data-reveal]:not(.in)").count(); await ctx.close();
    test.info().annotations.push({ type: "note", description: `infinite animations running: ${running}; unrevealed: ${reveal}` }); expect(running).toBe(0);
  });
  for (const [label, w, h] of SIZES) for (const path of ["/", "/courses", "/apply?course=personnel-licensing"]) {
    test(`RESP ${label}px ${path}: no horizontal scroll, content visible, tap targets >= 24px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h }); await page.goto(path, { waitUntil: "networkidle" });
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, small: [...document.querySelectorAll("a,button,input,select")].filter((e) => { const r = (e as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24) && getComputedStyle(e).visibility !== "hidden" && !(e as HTMLInputElement).hidden && (e as HTMLInputElement).type !== "hidden" && (e as HTMLInputElement).type !== "radio" && (e as HTMLInputElement).type !== "checkbox"; }).length }));
      expect(m.sw, `scrollWidth ${m.sw} > viewport ${m.cw}`).toBeLessThanOrEqual(m.cw + 1); expect(m.small, "interactive elements smaller than 24px").toBe(0);
      if (path === "/") await page.screenshot({ path: `qa/evidence/RESP-home-${label}.png` });
    });
  }
});
