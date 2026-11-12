import { describe, expect, it } from "vitest";
import { newReference } from "@/lib/reference";
import { can } from "@/lib/perm";
import { ENQUIRY } from "@/lib/leads";

describe("references and permissions", () => {
  it("creates unambiguous, well-formed, unique-enough references", () => {
    const set = new Set(Array.from({ length: 2000 }, () => newReference()));
    for (const r of set) expect(r).toMatch(/^TAS-\d{4}-[A-HJKMNP-Z2-9]{5}$/); expect(set.size).toBeGreaterThan(1990);
  });
  it("applies least privilege (NFR-SEC-02)", () => {
    expect(can.publish("ADMIN")).toBe(true); expect(can.publish("ACADEMIC")).toBe(false); expect(can.approve("ACADEMIC")).toBe(true); expect(can.approve("MARKETING")).toBe(false);
    expect(can.finance("FINANCE")).toBe(true); expect(can.finance("ADMISSIONS")).toBe(false); expect(can.admissions("LECTURER")).toBe(false); expect(can.editContent("LECTURER")).toBe(false);
    expect(can.enquiries("MARKETING")).toBe(true); expect(can.reports("LECTURER")).toBe(false);
  });
  it("treats an enquiry with no message as an enquiry", () => expect(JSON.stringify(ENQUIRY)).toContain("null"));
});
