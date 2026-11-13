import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} })); vi.mock("@/lib/notify", () => ({ COPY: {}, notifyApplicant: vi.fn() })); vi.mock("@/lib/admissions", () => ({ advanceApplicant: vi.fn() }));
import { splitTuition, toRwf, paidOn, outstandingOn, balanceOf } from "@/lib/finance";

const inv = (amount: number, pays: [string, number][], status = "PENDING") => ({ amountMinor: amount, status, payments: pays.map(([s, v]) => ({ status: s, valueRwf: v, amountMinor: v })) });
describe("finance rules (FIN-01, FIN-04, FIN-05)", () => {
  it("installments always add up to the fee, remainder on the first, one month apart", () => {
    for (const [total, n] of [[300000, 1], [300000, 2], [300000, 3], [100000, 3], [250001, 2], [7, 3]] as const) { const p = splitTuition(total, n, new Date("2027-01-11T00:00:00Z")); expect(p).toHaveLength(n); expect(p.reduce((s, x) => s + x.amount, 0)).toBe(total); expect(p.every((x) => x.amount > 0)).toBe(true); }
    const p = splitTuition(100000, 3, new Date("2027-01-31T00:00:00Z")); expect(p.map((x) => x.amount)).toEqual([33334, 33333, 33333]); expect(p.map((x) => x.dueOn.toISOString().slice(0, 10))).toEqual(["2027-01-28", "2027-02-28", "2027-03-28"]); expect(p.map((x) => x.installment)).toEqual([1, 2, 3]);
  });
  it("refuses nonsense amounts and clamps the number of installments", () => { expect(splitTuition(0, 2, new Date())).toEqual([]); expect(splitTuition(-5, 2, new Date())).toEqual([]); expect(splitTuition(1.5, 2, new Date())).toEqual([]); expect(splitTuition(1000, 0, new Date())).toHaveLength(1); expect(splitTuition(1000, 99, new Date())).toHaveLength(6); });
  it("converts currencies: USD in cents, CDF in units, RWF unchanged, null without a rate", () => { const r = { USD: 1450, CDF: 0.5 }; expect(toRwf(5000, "RWF", r)).toBe(5000); expect(toRwf(10000, "USD", r)).toBe(145000); expect(toRwf(2000, "CDF", r)).toBe(1000); expect(toRwf(100, "USD", {})).toBeNull(); expect(toRwf(100, "USD", { USD: 0 })).toBeNull(); });
  it("only confirmed money counts; reported (unmatched) payments do not", () => { const i = inv(100000, [["PART_PAYMENT", 30000], ["UNMATCHED", 70000], ["RECONCILED", 20000]]); expect(paidOn(i)).toBe(50000); expect(outstandingOn(i)).toBe(50000); expect(outstandingOn(inv(100, [["RECONCILED", 500]]))).toBe(0); expect(outstandingOn(inv(100, [], "CANCELLED"))).toBe(0); });
  it("balance ignores cancelled invoices and never counts an overpayment twice", () => { expect(balanceOf([inv(25000, [["RECONCILED", 25000]], "PAID"), inv(300000, [["PART_PAYMENT", 100000]]), inv(999, [], "CANCELLED")])).toEqual({ billed: 325000, paid: 125000, balance: 200000 }); expect(balanceOf([])).toEqual({ billed: 0, paid: 0, balance: 0 }); });
});
