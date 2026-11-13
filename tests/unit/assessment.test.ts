import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} })); vi.mock("@/lib/notify", () => ({ notifyApplicant: vi.fn() }));
import { parseScheme, schemeOf, computeResult, DEFAULT_SCHEME } from "@/lib/assessment";
import { certKind } from "@/lib/certificates";

describe("grading scheme and results (ASM-01, ASM-03)", () => {
  it("parses a scheme and refuses bad ones", () => {
    expect(parseScheme("Continuous assessment: 30\nWeekly tests = 20%\n\nFinal exam: 50", 50)).toEqual({ components: [{ name: "Continuous assessment", weight: 30 }, { name: "Weekly tests", weight: 20 }, { name: "Final exam", weight: 50 }], passMark: 50 });
    expect(parseScheme("Final: 60\nCA: 30", 50)).toMatch(/add up to 100/); expect(parseScheme("Final 100", 50)).toMatch(/one part per line/); expect(parseScheme("", 50)).toMatch(/one part per line/); expect(parseScheme("A: 50\na: 50", 50)).toMatch(/different name/); expect(parseScheme("A: 100\nB: 0", 50)).toMatch(/above zero/); expect(parseScheme("A: 100", 0)).toMatch(/pass mark/); expect(parseScheme("A: 100", 101)).toMatch(/pass mark/);
  });
  it("falls back to the default scheme for missing or broken data", () => { expect(schemeOf(null)).toBe(DEFAULT_SCHEME); expect(schemeOf({ components: [] })).toBe(DEFAULT_SCHEME); expect(schemeOf({ components: [{ name: "X", weight: 100 }], passMark: 60 }).passMark).toBe(60); expect(DEFAULT_SCHEME.components.reduce((n, c) => n + c.weight, 0)).toBe(100); });
  it("averages each part, weights the parts, and is provisional until every part has a result", () => {
    const s = DEFAULT_SCHEME; const ca = { component: "Continuous assessment", maxScore: 20, score: 15 }, ca2 = { component: "Continuous assessment", maxScore: 50, score: 25 }, wk = { component: "Weekly Friday assessments", maxScore: 10, score: 8 }, fin = { component: "Final exam", maxScore: 100, score: 70 };
    const partial = computeResult(s, [ca, ca2, wk]); expect(partial.parts.map((p) => p.pct)).toEqual([62.5, 80, null]); expect(partial.complete).toBe(false); expect(partial.passed).toBeNull(); expect(partial.overall).toBe(69.5);
    const full = computeResult(s, [ca, ca2, wk, fin]); expect(full.overall).toBe(69.8); expect(full.complete).toBe(true); expect(full.passed).toBe(true); expect(computeResult(s, [{ ...ca, score: 2 }, { ...wk, score: 1 }, { ...fin, score: 40 }]).passed).toBe(false);
    expect(computeResult(s, [])).toMatchObject({ overall: null, complete: false, passed: null }); expect(computeResult(s, [{ ...fin, score: null }, { component: "Unknown", maxScore: 10, score: 10 }]).overall).toBeNull();
    expect(computeResult({ components: [{ name: "Only", weight: 100 }], passMark: 50 }, [{ component: "Only", maxScore: 40, score: 20 }])).toMatchObject({ overall: 50, passed: true });
  });
  it("names the certificate after the programme type (CRT-01)", () => { expect(certKind("ADVANCED_CERTIFICATE")).toBe("Advanced Certificate"); expect(certKind("CERTIFICATE")).toBe("Certificate"); expect(certKind("IATA")).toBe("Certificate"); });
});
