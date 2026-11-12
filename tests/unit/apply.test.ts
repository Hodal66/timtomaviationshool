import { describe, expect, it } from "vitest";
import { ageOf, cleanPhone, validate } from "@/lib/apply";

const good = { course: "x", branch: "b", session: "WEEKDAY", start: "2027-01", fullName: "Aline Uwase", phone: "+250788100200", email: "a@b.rw", dob: "2003-04-09", educationLevel: "Other", institution: "Lycee", completionYear: "2021" };

describe("application rules (UX-02, ADM-02, ADM-10)", () => {
  it("accepts a complete application", () => expect(validate(good, "all")).toEqual({}));
  it("requires programme, then branch, then schedule, then start", () => {
    expect(validate({}, "programme").course).toBeTruthy();
    expect(validate({ course: "x" }, "programme").branch).toBeTruthy();
    expect(validate({ course: "x", branch: "b" }, "programme").session).toBeTruthy();
    expect(validate({ course: "x", branch: "b", session: "WEEKEND" }, "programme").start).toBeTruthy();
    expect(validate({ course: "x", branch: "b", session: "NIGHT", start: "2027-01" }, "programme").session).toBeTruthy();
  });
  it("requires a name and a phone or an email", () => {
    expect(validate({ ...good, fullName: " " }, "details").fullName).toBeTruthy();
    expect(validate({ ...good, phone: "", email: "" }, "details").phone).toBeTruthy();
    expect(validate({ ...good, phone: "", email: "a@b.rw" }, "details").phone).toBeUndefined();
  });
  it.each(["abc", "123", "+25", "07"])("rejects invalid phone %s", (p) => expect(validate({ ...good, phone: p, email: "" }, "details").phone).toBeTruthy());
  it.each(["a@", "@b.rw", "a b@c.rw", "plain"])("rejects invalid email %s", (e) => expect(validate({ ...good, email: e }, "details").email).toBeTruthy());
  it("rejects impossible dates of birth", () => {
    expect(validate({ ...good, dob: "" }, "details").dob).toBeTruthy();
    expect(validate({ ...good, dob: "not-a-date" }, "details").dob).toBeTruthy();
    expect(validate({ ...good, dob: "1900-01-01" }, "details").dob).toBeTruthy();
    expect(validate({ ...good, dob: new Date(Date.now() + 864e5).toISOString().slice(0, 10) }, "details").dob).toBeTruthy();
  });
  it("detects applicants under 18 and then requires a guardian (ADM-10)", () => {
    const minor = new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10);
    expect(ageOf(minor)).toBeLessThan(18);
    const e = validate({ ...good, dob: minor }, "details");
    expect(e.guardianName).toBeTruthy(); expect(e.guardianPhone).toBeTruthy();
    expect(validate({ ...good, dob: minor, guardianName: "Parent", guardianPhone: "+250788000111" }, "details")).toEqual({});
  });
  it("validates education", () => {
    expect(validate({ ...good, educationLevel: "" }, "education").educationLevel).toBeTruthy();
    expect(validate({ ...good, institution: "" }, "education").institution).toBeTruthy();
    for (const y of ["1969", "abc", "", "3000"]) expect(validate({ ...good, completionYear: y }, "education").completionYear).toBeTruthy();
  });
  it("normalises phone numbers", () => { expect(cleanPhone("+250 788-100 200")).toBe("+250788100200"); expect(cleanPhone(undefined)).toBe(""); });
});
