import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/notify", () => ({ emailConfigured: () => true, sendEmail: vi.fn(async () => {}) }));
import { requestOtp, verifyOtp, EMAIL_RE, normEmail } from "@/lib/otp";
import { sendEmail } from "@/lib/notify";
import { db } from "./db";

const sent = () => (sendEmail as unknown as ReturnType<typeof vi.fn>).mock.calls;
const codeOf = () => String(sent().at(-1)![2]).match(/\b(\d{6})\b/)![1];
let n = 0; const mail = () => `otp${Date.now()}${n++}@example.com`;
describe("email one-time codes", () => {
  beforeEach(() => { (sendEmail as unknown as ReturnType<typeof vi.fn>).mockClear(); });
  it("validates and normalises addresses", () => { expect(EMAIL_RE.test("a@b.co")).toBe(true); expect(EMAIL_RE.test("nope")).toBe(false); expect(normEmail("  Foo@Bar.COM ")).toBe("foo@bar.com"); expect(normEmail(5)).toBe(""); });
  it("emails a 6-digit code, stores only a hash, and accepts it once", async () => {
    const e = mail(); expect((await requestOtp(e, "en", "ip1")).ok).toBe(true); expect(sent()).toHaveLength(1); expect(sent()[0][0]).toBe(e); const code = codeOf(); expect(code).toMatch(/^\d{6}$/);
    const row = await db.emailOtp.findFirstOrThrow({ where: { email: e } }); expect(row.codeHash).not.toContain(code); expect(row.codeHash).toHaveLength(64);
    expect((await verifyOtp(e, code, "en")).ok).toBe(true); const again = await verifyOtp(e, code, "en"); expect(again.ok).toBe(false);
  });
  it("is case-insensitive about the email and ignores non-digits in the code", async () => { const e = mail(); await requestOtp(e.toUpperCase(), "en", "ip2"); const code = codeOf(); expect((await verifyOtp(e, ` ${code.slice(0, 3)}-${code.slice(3)} `, "en")).ok).toBe(true); });
  it("a newer code replaces the older one", async () => { const e = mail(); await requestOtp(e, "en", "ip3"); const first = codeOf(); await requestOtp(e, "en", "ip3"); const second = codeOf(); if (first !== second) expect((await verifyOtp(e, first, "en")).ok).toBe(false); expect((await verifyOtp(e, second, "en")).ok).toBe(true); });
  it("locks a code after 5 wrong tries, even for the right code", async () => {
    const e = mail(); await requestOtp(e, "en", "ip4"); const code = codeOf(); const wrong = code === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i++) expect((await verifyOtp(e, wrong, "en")).ok).toBe(false); expect((await verifyOtp(e, code, "en")).ok).toBe(false);
  });
  it("rejects expired codes", async () => { const e = mail(); await requestOtp(e, "en", "ip5"); const code = codeOf(); await db.emailOtp.updateMany({ where: { email: e }, data: { expiresAt: new Date(Date.now() - 1000) } }); expect((await verifyOtp(e, code, "en")).ok).toBe(false); });
  it("refuses bad input and a code that was never requested", async () => { expect((await requestOtp("bad", "en", "ip6")).ok).toBe(false); expect((await verifyOtp(mail(), "123456", "en")).ok).toBe(false); expect((await verifyOtp("x", "12", "en")).ok).toBe(false); });
  it("limits requests: 5 codes per email per hour", async () => { const e = mail(); const r: boolean[] = []; for (let i = 0; i < 6; i++) r.push((await requestOtp(e, "en", "ip7")).ok); expect(r).toEqual([true, true, true, true, true, false]); });
  it("writes the email in the applicant's language", async () => { const e = mail(); await requestOtp(e, "fr", "ip8"); expect(String(sent().at(-1)![1])).toContain("code de vérification"); await requestOtp(mail(), "rw", "ip8"); expect(String(sent().at(-1)![1])).toContain("Kode yawe"); });
  it("marks matching applicants as email-verified after a successful check", async () => {
    const e = mail(); const prog = await db.programme.findFirstOrThrow({ where: { status: "PUBLISHED" } }); const br = await db.branch.findFirstOrThrow(); const it = await db.intake.findFirstOrThrow();
    const a = await db.applicant.create({ data: { fullName: "Verify Me", email: e, programmeId: prog.id, branchId: br.id, intakeId: it.id } }); expect(a.emailVerifiedAt).toBeNull();
    await requestOtp(e, "en", "ip9"); await verifyOtp(e, codeOf(), "en"); expect((await db.applicant.findUniqueOrThrow({ where: { id: a.id } })).emailVerifiedAt).not.toBeNull();
  });
});
