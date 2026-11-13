import { describe, it, expect, beforeAll } from "vitest";
import { db, uniquePhone } from "./db";
import { setTuitionPlan, recordPayment, claimPayment, matchStatement, sendDueReminders, balanceOf } from "@/lib/finance";
import { advanceApplicant } from "@/lib/admissions";

let n = 0; const ref = () => `TAS-FIN-${Date.now().toString(36).toUpperCase()}${n++}`; const txn = () => `TX${Date.now()}${n++}`;
async function admitted(fee = 300000) {
  const prog = await db.programme.create({ data: { code: "FIN" + Date.now() + n++, name: "Finance Test " + n, type: "CERTIFICATE", status: "DRAFT", feeRwf: fee } }); const br = await db.branch.findFirstOrThrow(); const it = await db.intake.findFirstOrThrow();
  const a = await db.applicant.create({ data: { fullName: "Fin Tester", email: `fin${Date.now()}${n++}@example.com`, phone: uniquePhone(), reference: ref(), status: "ADMITTED", programmeId: prog.id, branchId: br.id, intakeId: it.id } });
  return a;
}
const invs = (id: string) => db.invoice.findMany({ where: { applicantId: id }, include: { payments: true }, orderBy: { installment: "asc" } });
describe("finance with the database", () => {
  beforeAll(async () => { await db.exchangeRate.upsert({ where: { currency: "USD" }, update: { rwfPerUnit: 1400 }, create: { currency: "USD", rwfPerUnit: 1400 } }); });
  it("tuition is invoiced automatically when an applicant is admitted (FIN-01)", async () => {
    const a = await admitted(); await db.applicant.update({ where: { id: a.id }, data: { status: "REGISTRATION_PAID" } }); expect(await advanceApplicant(a.id, "QA")).toBeNull();
    const i = await invs(a.id); expect(i).toHaveLength(1); expect([i[0].kind, i[0].amountMinor, i[0].reference]).toEqual(["TUITION", 300000, `TUI-${a.reference}-1`]); expect(i[0].dueOn).not.toBeNull();
  });
  it("plan can be changed to 2 or 3 installments until money is recorded, then it is locked (FIN-04)", async () => {
    const a = await admitted(100000); expect(await setTuitionPlan(a.id, 3, "QA")).toBeNull(); let i = await invs(a.id); expect(i.map((x) => x.amountMinor)).toEqual([33334, 33333, 33333]);
    expect(await setTuitionPlan(a.id, 2, "QA")).toBeNull(); i = await invs(a.id); expect(i.map((x) => x.amountMinor)).toEqual([50000, 50000]); expect(await setTuitionPlan(a.id, 5, "QA")).toMatch(/1, 2 or 3/);
    expect(await recordPayment({ invoiceId: i[0].id, reference: txn(), channel: "MTN_MOMO", actor: "Fin" })).toBeNull(); expect(await setTuitionPlan(a.id, 1, "QA")).toMatch(/can no longer be changed/); expect(await invs(a.id)).toHaveLength(2);
  });
  it("is refused before admission and for programmes without a fee", async () => { const a = await admitted(); await db.applicant.update({ where: { id: a.id }, data: { status: "SUBMITTED" } }); expect(await setTuitionPlan(a.id, 1, "QA")).toMatch(/once the applicant is admitted/); const b = await admitted(); await db.programme.update({ where: { id: b.programmeId }, data: { feeRwf: null } }); expect(await setTuitionPlan(b.id, 1, "QA")).toMatch(/no tuition fee/); });
  it("part payments keep the invoice open; it is paid when the total is covered; overpayment and reused references are refused (FIN-09)", async () => {
    const a = await admitted(100000); await setTuitionPlan(a.id, 1, "QA"); const [i] = await invs(a.id); const t1 = txn();
    expect(await recordPayment({ invoiceId: i.id, reference: t1, channel: "EQUITY", amountMinor: 40000, actor: "Fin" })).toBeNull(); let [x] = await invs(a.id); expect(x.status).toBe("PENDING"); expect(x.payments[0].status).toBe("PART_PAYMENT"); expect(balanceOf([x])).toEqual({ billed: 100000, paid: 40000, balance: 60000 });
    expect(await recordPayment({ invoiceId: i.id, reference: t1, channel: "EQUITY", amountMinor: 10000, actor: "Fin" })).toMatch(/already recorded/); expect(await recordPayment({ invoiceId: i.id, reference: txn(), channel: "EQUITY", amountMinor: 60001, actor: "Fin" })).toMatch(/more than/);
    expect(await recordPayment({ invoiceId: i.id, reference: "", channel: "EQUITY", actor: "Fin" })).toMatch(/transaction reference/); expect(await recordPayment({ invoiceId: i.id, reference: txn(), channel: "BITCOIN", actor: "Fin" })).toMatch(/channel/);
    expect(await recordPayment({ invoiceId: i.id, reference: txn(), channel: "CASH", actor: "Fin" })).toBeNull(); [x] = await invs(a.id); expect(x.status).toBe("PAID"); expect(x.paidAt).not.toBeNull(); expect(await recordPayment({ invoiceId: i.id, reference: txn(), channel: "CASH", actor: "Fin" })).toMatch(/not open/);
  });
  it("accepts a payment in US dollars at the Finance rate, and refuses a currency without a rate (FIN-05)", async () => {
    const a = await admitted(140000); await setTuitionPlan(a.id, 1, "QA"); const [i] = await invs(a.id); await db.exchangeRate.deleteMany({ where: { currency: "CDF" } });
    expect(await recordPayment({ invoiceId: i.id, reference: txn(), channel: "EQUITY", amountMinor: 5000, currency: "CDF", actor: "Fin" })).toMatch(/exchange rate/);
    expect(await recordPayment({ invoiceId: i.id, reference: txn(), channel: "EQUITY", amountMinor: 10000, currency: "USD", actor: "Fin" })).toBeNull(); const [x] = await invs(a.id); expect(x.status).toBe("PAID"); expect([x.payments[0].currency, x.payments[0].amountMinor, x.payments[0].valueRwf]).toEqual(["USD", 10000, 140000]);
  });
  it("an applicant reports a payment; it does not count until Finance confirms; the statement import confirms exact matches only (FIN-02 interim, FIN-03)", async () => {
    const a = await admitted(90000); await setTuitionPlan(a.id, 3, "QA"); const i = await invs(a.id); const t1 = txn(), t2 = txn();
    expect(await claimPayment("someone.else@example.com", i[0].id, "MTN_MOMO", t1, 30000)).toMatch(/not found/); expect(await claimPayment(a.email!, i[0].id, "CASH", t1, 30000)).toMatch(/how you paid/i); expect(await claimPayment(a.email!, i[0].id, "MTN_MOMO", "x", 30000)).toMatch(/transaction reference/); expect(await claimPayment(a.email!, i[0].id, "MTN_MOMO", t1, 999999)).toMatch(/up to/);
    expect(await claimPayment(a.email!, i[0].id, "MTN_MOMO", t1, 30000)).toBeNull(); expect(await claimPayment(a.email!, i[1].id, "AIRTEL_MONEY", t2, 30000)).toBeNull(); expect(await claimPayment(a.email!, i[2].id, "MTN_MOMO", t1, 30000)).toMatch(/already used/);
    expect(balanceOf(await invs(a.id)).paid).toBe(0);
    const r = await matchStatement(`reference,amount\n${t1}, 30000\n"${t2}";29000\nUNKNOWN-REF\t500\n\n`, "Fin"); expect([r.lines, r.matched, r.amountMismatch, r.unknown]).toEqual([3, 1, [t2], ["UNKNOWN-REF"]]);
    const after = await invs(a.id); expect(after[0].status).toBe("PAID"); expect(after[1].status).toBe("PENDING"); expect(balanceOf(after).paid).toBe(30000); expect((await db.payment.findUniqueOrThrow({ where: { reference: t1 } })).verifiedBy).toBe("Fin (statement)");
  });
  it("sends one reminder for invoices due soon or overdue, and not again within 3 days (FIN-04)", async () => {
    const a = await admitted(60000); await setTuitionPlan(a.id, 2, "QA"); const i = await invs(a.id); await db.invoice.update({ where: { id: i[0].id }, data: { dueOn: new Date(Date.now() - 864e5) } }); await db.invoice.update({ where: { id: i[1].id }, data: { dueOn: new Date(Date.now() + 40 * 864e5) } });
    await sendDueReminders(); const x = await invs(a.id); expect(x[0].remindedAt).not.toBeNull(); expect(x[1].remindedAt).toBeNull(); const first = x[0].remindedAt!.getTime(); await sendDueReminders(); expect((await invs(a.id))[0].remindedAt!.getTime()).toBe(first);
    expect(await db.notification.count({ where: { applicantId: a.id, template: "invoice_overdue" } })).toBeGreaterThanOrEqual(1);
  });
});
