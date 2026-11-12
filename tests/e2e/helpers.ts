import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

export const db = new PrismaClient();
export const ADMIN = { email: "admin@test.local", password: "localtest-123" };
let n = 0;
export const uniquePhone = () => `+25079${String(Date.now()).slice(-5)}${String(n++ % 1000).padStart(3, "0")}`;
export const FIX = (f: string) => `tests/fixtures/${f}`;

export async function loginStaff(page: Page, who = ADMIN) {
  await page.goto("/login"); await page.fill("#email", who.email); await page.fill("#password", who.password);
  await Promise.all([page.waitForURL("**/dashboard"), page.click("button[type=submit]")]);
}
export const scrollAll = (p: Page) => p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 450) { scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 70)); } scrollTo({ top: 0, behavior: "instant" }); });
export const readMail = () => (fs.existsSync("tests/.tmp/mail.jsonl") ? fs.readFileSync("tests/.tmp/mail.jsonl", "utf8") : "").trim().split("\n").filter(Boolean).map((l) => {
  const m = JSON.parse(l) as { from: string; rcpt: string[]; raw: string };
  return { ...m, text: m.raw.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) };
});

/** Start key of the next intake, e.g. "2027-01", read from the wizard so tests follow the real calendar. */
export async function nextStart(page: Page) { await page.goto("/apply"); return page.inputValue("#f-start"); }

export type Apply = { course?: string; branch?: string; session?: string; start?: string; fullName?: string; phone?: string; email?: string; dob?: string };
/** Creates an application through the public API exactly as the wizard does (draft, then submit). */
export async function apiApply(request: APIRequestContext, o: Apply = {}) {
  const branch = o.branch ?? (await db.branch.findFirstOrThrow({ where: { code: "KGL" } })).id;
  const data = { course: "personnel-licensing", branch, session: "WEEKDAY", start: o.start ?? "2027-01", fullName: "QA Applicant", phone: uniquePhone(), dob: "2002-02-02", educationLevel: "Other", institution: "QA School", completionYear: "2020", ...o };
  const d = await request.post("/api/apply/draft", { data: { data, step: 4 } }); const { token } = await d.json();
  const r = await request.post("/api/apply/submit", { data: { token } }); return { token, body: await r.json(), data, status: r.status() };
}
export async function expectNoHorizontalScroll(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0); }

import { test } from "@playwright/test";
/** Records a requirement that the release does not implement. Shown as NOT IMPLEMENTED in the register, never as PASS. */
export function notImplemented(reason: string): never {
  test.info().annotations.push({ type: "status", description: "NOT IMPLEMENTED" }, { type: "reason", description: reason });
  test.skip(true, reason); throw new Error("unreachable");
}
/** Records a test that cannot run in this environment. Shown as BLOCKED. */
export function blocked(reason: string): never {
  test.info().annotations.push({ type: "status", description: "BLOCKED" }, { type: "reason", description: reason });
  test.skip(true, reason); throw new Error("unreachable");
}

import bcrypt from "bcryptjs";
export type Role = "ADMIN" | "ADMISSIONS" | "FINANCE" | "LECTURER" | "BRANCH_MANAGER" | "ACADEMIC" | "MARKETING";
export const PASS = "QaPass-12345";
/** Creates (once) a clearly labelled QA staff account for a role and returns its credentials. */
export async function staff(role: Role) {
  const email = `qa.${role.toLowerCase()}@test.local`;
  await db.user.upsert({ where: { email }, update: {}, create: { email, name: `QA ${role}`, role, passwordHash: await bcrypt.hash(PASS, 4) } });
  return { email, password: PASS };
}
export async function adminCourseLifecycle(page: Page, name: string, o: { summary?: string; description?: string; fee?: string } = {}) {
  await page.goto("/admin/courses"); await page.fill("input[name=name]", name); await page.selectOption("select[name=type]", "CERTIFICATE");
  await Promise.all([page.waitForURL(/\/admin\/courses\/[^/]+$/), page.click("button:has-text('Create draft')")]);
  const id = page.url().split("/").pop()!;
  await page.selectOption("#visualTheme", "cargo"); await page.fill("#qualificationType", "Local certificate"); await page.fill("#summary", o.summary ?? "QA summary sentence."); await page.fill("#description", o.description ?? "QA summary sentence. More QA description text for the course page.");
  if (o.fee) await page.fill("#feeRwf", o.fee);
  await Promise.all([page.waitForURL(/ok=1/), page.click("button:has-text('Save draft')")]);
  return id;
}
export async function clickAction(page: Page, text: string) { await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: text, exact: true }).click()]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(300); }

/** Shares state between tests through a file, so a failed test (which restarts the worker) cannot wipe it. */
const STATE = "tests/.tmp/state.json";
export const getState = <T extends Record<string, unknown>>(key: string, init: () => T): T => { const s = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {}; if (!s[key]) { s[key] = init(); fs.mkdirSync("tests/.tmp", { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s)); } return s[key] as T; };
export const setState = (key: string, v: Record<string, unknown>) => { const s = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {}; s[key] = { ...(s[key] ?? {}), ...v }; fs.writeFileSync(STATE, JSON.stringify(s)); };
