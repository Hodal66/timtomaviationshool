import { describe, it, expect, beforeAll } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildAdmissionLetter, letterCode, letterCodeOk, letterUrl } from "@/lib/letter";

const D = { reference: "TAS-2611-ABCDE", fullName: "Uwase Marie Claire", programme: "Advanced Certificate in Air Cabin Crew", qualification: "Advanced certificate", branch: "Kigali", intake: "January 2027", startsOn: new Date("2027-01-11"), session: "Weekday (Monday to Friday)", admittedAt: new Date("2026-11-13"), feeRwf: 300000, requirements: ["A2 certificate", "Good English"] };
describe("admission letter (ADM-07)", () => {
  beforeAll(() => { process.env.AUTH_SECRET = "unit-test-secret"; });
  it("makes a 2-page PDF with the reference in its title", async () => { const bytes = await buildAdmissionLetter(D); expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-"); const pdf = await PDFDocument.load(bytes); expect(pdf.getPageCount()).toBe(2); expect(pdf.getTitle()).toContain(D.reference); expect(bytes.length).toBeGreaterThan(3000); });
  it("does not break on names or text outside the PDF font's character set", async () => { const bytes = await buildAdmissionLetter({ ...D, fullName: "Ngũgĩ 山田 — O’Brien", requirements: ["“Quoted” requirement – with dashes"], qualification: null, feeRwf: null, startsOn: null }); expect(bytes.length).toBeGreaterThan(3000); });
  it("verification code is stable, tied to the reference and the secret, and checked exactly", () => {
    const c = letterCode(D.reference); expect(c).toMatch(/^[0-9A-F]{12}$/); expect(letterCode(D.reference)).toBe(c); expect(letterCode("TAS-2611-ZZZZZ")).not.toBe(c);
    expect(letterCodeOk(D.reference, c)).toBe(true); expect(letterCodeOk(D.reference, c.toLowerCase())).toBe(true); expect(letterCodeOk(D.reference, "000000000000")).toBe(false); expect(letterCodeOk(D.reference, "")).toBe(false); expect(letterCodeOk("TAS-2611-ZZZZZ", c)).toBe(false);
    process.env.AUTH_SECRET = "another"; expect(letterCode(D.reference)).not.toBe(c); process.env.AUTH_SECRET = "unit-test-secret";
    expect(letterUrl(D.reference)).toContain(`/verify?letter=${D.reference}&k=${c}`);
  });
});
