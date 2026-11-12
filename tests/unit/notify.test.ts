import { describe, expect, it } from "vitest";
import { COPY, waLink, waNumber } from "@/lib/notify";

const a = { id: "1", fullName: "Aline Uwase", email: "a@b.rw", phone: "+250788100200", reference: "TAS-2611-ABCDE", programme: { name: "Personnel Licensing" }, intake: { label: "January 2027" }, branch: { name: "Kigali" }, session: "WEEKDAY" };

describe("WhatsApp numbers and message copy (ADM-04)", () => {
  it.each([["+250 788 100 200", "250788100200"], ["0788100200", "250788100200"], ["250788100200", "250788100200"], ["+243 970 000 000", "243970000000"], ["", null], [null, null], ["abc", null]])("normalises %s", (i, o) => expect(waNumber(i as string)).toBe(o));
  it("builds an encoded wa.me link or null", () => {
    expect(waLink("0788100200", "Hi there & you")).toBe("https://wa.me/250788100200?text=Hi%20there%20%26%20you"); expect(waLink("", "x")).toBeNull();
  });
  it("submitted copy contains reference, placement and tracking link", () => {
    const m = COPY.submitted(a); expect(m.subject).toContain("TAS-2611-ABCDE"); expect(m.text).toContain("Kigali"); expect(m.text).toContain("January 2027"); expect(m.text).toContain("/track?ref=TAS-2611-ABCDE"); expect(m.text).toContain("Hello Aline,");
  });
  it("covers every workflow status with a distinct template", () => {
    const t = ["DOCUMENTS_VERIFIED", "REGISTRATION_PAID", "ADMITTED", "ENROLLED", "REJECTED"].map((s) => COPY.status(a, s).template);
    expect(new Set(t).size).toBe(5);
  });
  it("rejection copy never carries internal reasons", () => expect(COPY.status(a, "REJECTED").text).not.toMatch(/reason/i));
  it("invoice and payment copy show amount and reference", () => {
    expect(COPY.invoice(a, "INV-1", "Registration fee", 50000).text).toContain("RWF 50,000"); expect(COPY.paid(a, "INV-1").text).toContain("INV-1");
    expect(COPY.docMissing(a, "Passport-size photo").text).toContain("Passport-size photo"); expect(COPY.placement(a).text).toContain("weekday");
  });
  it("falls back safely for an unknown status", () => expect(COPY.status(a, "WHAT").subject).toContain("Update"));
});
