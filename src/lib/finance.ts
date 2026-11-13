import { db } from "./db";
import { COPY, notifyApplicant, type Msg } from "./notify";
import { advanceApplicant } from "./admissions";
import { money } from "./format";
import { SITE } from "./site";

export const CHANNELS = ["MTN_MOMO", "AIRTEL_MONEY", "BANK_OF_KIGALI", "IM_BANK", "EQUITY", "CASH"] as const;
export const CURRENCIES = ["RWF", "USD", "CDF"] as const;
export type Cur = (typeof CURRENCIES)[number];
export const PLAN_CHOICES = [1, 2, 3] as const;

/** Splits a tuition amount into n installments one month apart. The remainder goes on the first, so the parts always add up exactly. */
export function splitTuition(total: number, n: number, first: Date): { amount: number; dueOn: Date; installment: number }[] {
  if (!Number.isInteger(total) || total <= 0) return []; const k = Math.max(1, Math.min(6, Math.floor(n) || 1)); const base = Math.floor(total / k);
  return Array.from({ length: k }, (_, i) => { const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, Math.min(first.getUTCDate(), 28))); return { amount: base + (i === 0 ? total - base * k : 0), dueOn: d, installment: i + 1 }; });
}
/** Converts an amount to RWF. USD is held in cents, RWF and CDF in whole units. Returns null when no rate is set. */
export function toRwf(amountMinor: number, currency: string, rates: Partial<Record<Cur, number>>): number | null {
  if (currency === "RWF") return amountMinor; const r = rates[currency as Cur]; if (!r || r <= 0) return null;
  return Math.round((currency === "USD" ? amountMinor / 100 : amountMinor) * r);
}
export async function getRates(): Promise<Partial<Record<Cur, number>>> { const rows = await db.exchangeRate.findMany(); return Object.fromEntries(rows.map((r) => [r.currency, r.rwfPerUnit])); }

type InvWithPay = { amountMinor: number; status: string; payments: { status: string; valueRwf: number | null; amountMinor: number }[] };
/** Money confirmed by Finance against an invoice, in RWF. Unconfirmed claims do not count. */
export const paidOn = (i: InvWithPay) => i.payments.filter((p) => p.status !== "UNMATCHED").reduce((n, p) => n + (p.valueRwf ?? p.amountMinor), 0);
export const outstandingOn = (i: InvWithPay) => (i.status === "CANCELLED" ? 0 : Math.max(0, i.amountMinor - paidOn(i)));
export function balanceOf(invoices: InvWithPay[]) { const live = invoices.filter((i) => i.status !== "CANCELLED"); const billed = live.reduce((n, i) => n + i.amountMinor, 0), paid = live.reduce((n, i) => n + Math.min(i.amountMinor, paidOn(i)), 0); return { billed, paid, balance: billed - paid }; }

/** FIN-01/04: creates (or re-creates) the tuition invoices of an applicant as 1 to 3 installments. Refused once any tuition money is recorded. */
export async function setTuitionPlan(applicantId: string, n: number, actor: string): Promise<string | null> {
  const a = await db.applicant.findUnique({ where: { id: applicantId }, include: { programme: true, intake: true, invoices: { where: { kind: "TUITION" }, include: { payments: true } } } });
  if (!a || !a.reference) return "Applicant not found."; const fee = a.programme.feeRwf;
  if (!fee) return "This programme has no tuition fee set.";
  if (!["ADMITTED", "ENROLLED"].includes(a.status)) return "Tuition is invoiced once the applicant is admitted.";
  if (!PLAN_CHOICES.includes(n as 1)) return "Choose 1, 2 or 3 installments.";
  if (a.invoices.some((i) => i.payments.length > 0)) return "A payment is already recorded against the tuition, so the plan can no longer be changed here. Ask Finance.";
  const start = a.intake.startsOn > new Date() ? a.intake.startsOn : new Date(Date.now() + 7 * 864e5); const parts = splitTuition(fee, n, start);
  await db.$transaction([
    db.invoice.deleteMany({ where: { applicantId, kind: "TUITION" } }),
    ...parts.map((p) => db.invoice.create({ data: { reference: `TUI-${a.reference}-${p.installment}`, applicantId, kind: "TUITION", installment: p.installment, dueOn: p.dueOn, amountMinor: p.amount, currency: "RWF", description: parts.length === 1 ? `Tuition, ${a.programme.name}` : `Tuition installment ${p.installment} of ${parts.length}, ${a.programme.name}` } })),
    db.applicationEvent.create({ data: { applicantId, type: "PAYMENT", actorName: actor, message: `Tuition plan set: ${parts.length} installment${parts.length > 1 ? "s" : ""}, ${money(fee, "RWF")} in total.` } }),
  ]);
  return null;
}

export type PayInput = { invoiceId: string; reference: string; channel: string; amountMinor?: number; currency?: string; actor: string };
/** Finance records money against an invoice. Part payments keep the invoice open; the invoice is paid when the confirmed total covers it. */
export async function recordPayment(p: PayInput, existingPaymentId?: string): Promise<string | null> {
  const reference = p.reference.trim().slice(0, 60); if (!reference) return "Enter the bank or mobile-money transaction reference.";
  if (!CHANNELS.includes(p.channel as "CASH")) return "Choose the payment channel.";
  const inv = await db.invoice.findUnique({ where: { id: p.invoiceId }, include: { payments: true, applicant: true } });
  if (!inv || inv.status !== "PENDING") return "That invoice is not open.";
  const dupe = await db.payment.findUnique({ where: { reference } }); if (dupe && dupe.id !== existingPaymentId) return "That transaction reference was already recorded."; // FIN-09
  const currency = CURRENCIES.includes(p.currency as Cur) ? (p.currency as Cur) : "RWF"; const due = outstandingOn(inv);
  const amount = p.amountMinor && p.amountMinor > 0 ? Math.round(p.amountMinor) : due; const value = toRwf(amount, currency, await getRates());
  if (value === null) return `Set today's ${currency} exchange rate first.`;
  if (value > due) return `That is more than the ${money(due, "RWF")} still due on this invoice.`;
  const full = value >= due; const data = { reference, amountMinor: amount, currency, valueRwf: value, channel: p.channel as never, status: (full ? "RECONCILED" : "PART_PAYMENT") as never, applicantId: inv.applicantId, invoiceId: inv.id, verifiedBy: p.actor, paidAt: new Date() };
  await db.$transaction([
    existingPaymentId ? db.payment.update({ where: { id: existingPaymentId }, data }) : db.payment.create({ data }),
    ...(full ? [db.invoice.update({ where: { id: inv.id }, data: { status: "PAID", paidAt: new Date() } })] : []),
    db.applicationEvent.create({ data: { applicantId: inv.applicantId, type: "PAYMENT", actorName: p.actor, message: full ? `Payment verified by Finance (${reference}).` : `Part payment of ${money(value, "RWF")} verified by Finance (${reference}). ${money(due - value, "RWF")} still due on ${inv.reference}.` } }),
  ]);
  if (full && inv.kind === "REGISTRATION" && inv.applicant.status === "DOCUMENTS_VERIFIED") await advanceApplicant(inv.applicantId, "System");
  else await notifyApplicant(inv.applicantId, (ap) => (full ? COPY.paid(ap, inv.reference) : { template: "part_paid", subject: `Part payment received (${inv.reference})`, text: `Hello ${ap.fullName.split(" ")[0]},\n\nWe confirmed ${money(value, "RWF")} against ${inv.reference}. ${money(due - value, "RWF")} is still due.\n${SITE.url}/me\n\n${SITE.name}` }));
  return null;
}

/** FIN-02 (interim, until the mobile-money APIs are connected): the applicant reports a payment; Finance confirms it or the statement import matches it. */
export async function claimPayment(email: string, invoiceId: string, channel: string, referenceRaw: string, amountMinor: number): Promise<string | null> {
  const reference = referenceRaw.trim().slice(0, 60); if (reference.length < 4) return "Enter the transaction reference from your payment message.";
  if (!CHANNELS.includes(channel as "CASH") || channel === "CASH") return "Choose how you paid.";
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { applicant: true, payments: true } });
  if (!inv || inv.applicant.email !== email) return "Invoice not found."; if (inv.status !== "PENDING") return "That invoice is not open.";
  const due = outstandingOn(inv); const amount = Math.round(amountMinor) || due; if (amount <= 0 || amount > due) return `Enter an amount up to ${money(due, "RWF")}.`;
  if (inv.payments.filter((p) => p.status === "UNMATCHED").length >= 3) return "You already reported payments for this invoice. Finance is checking them.";
  if (await db.payment.findUnique({ where: { reference } })) return "That transaction reference was already used.";
  await db.payment.create({ data: { reference, amountMinor: amount, currency: "RWF", valueRwf: amount, channel: channel as never, status: "UNMATCHED", claimedBy: "APPLICANT", applicantId: inv.applicantId, invoiceId: inv.id } });
  await db.applicationEvent.create({ data: { applicantId: inv.applicantId, type: "PAYMENT", actorName: "Applicant", message: `Reported a payment of ${money(amount, "RWF")} (${reference}). Waiting for Finance to confirm.` } });
  return null;
}

/** FIN-03: matches statement lines "reference,amount" against reported payments. Only exact reference and amount matches are confirmed. */
export async function matchStatement(text: string, actor: string) {
  const out = { matched: 0, amountMismatch: [] as string[], unknown: [] as string[], lines: 0 };
  for (const raw of text.split(/\r?\n/).slice(0, 2000)) {
    const cells = raw.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, "")); if (cells.length < 2 || !cells[0]) continue;
    const amount = Number(cells[cells.length - 1].replace(/[^\d.]/g, "")); if (!Number.isFinite(amount) || amount <= 0) continue; // header or junk line
    out.lines++; const claim = await db.payment.findUnique({ where: { reference: cells[0] } });
    if (!claim || claim.status !== "UNMATCHED" || !claim.invoiceId) { if (!claim) out.unknown.push(cells[0]); continue; }
    if (Math.round(amount) !== claim.amountMinor) { out.amountMismatch.push(cells[0]); continue; }
    const err = await recordPayment({ invoiceId: claim.invoiceId, reference: claim.reference!, channel: claim.channel, amountMinor: claim.amountMinor, currency: "RWF", actor: `${actor} (statement)` }, claim.id);
    if (!err) out.matched++; else out.unknown.push(cells[0]);
  }
  return out;
}

/** FIN-04 reminders: invoices due within 3 days or overdue, at most one reminder every 3 days. */
export async function sendDueReminders(now = new Date()) {
  const soon = new Date(+now + 3 * 864e5), gap = new Date(+now - 3 * 864e5);
  const due = await db.invoice.findMany({ where: { status: "PENDING", dueOn: { lte: soon }, OR: [{ remindedAt: null }, { remindedAt: { lt: gap } }] }, include: { payments: true }, take: 200 });
  for (const i of due) { const left = outstandingOn(i); if (left <= 0) continue; const late = i.dueOn! < now;
    await notifyApplicant(i.applicantId, (a): Msg => ({ template: late ? "invoice_overdue" : "invoice_due", subject: `${late ? "Payment overdue" : "Payment due soon"}: ${i.reference}`, text: `Hello ${a.fullName.split(" ")[0]},\n\n${i.description}: ${money(left, "RWF")} ${late ? "was due on" : "is due on"} ${i.dueOn!.toISOString().slice(0, 10)}.\nPay by mobile money or bank using the reference ${i.reference}, then report the payment on your dashboard:\n${SITE.url}/me\n\n${SITE.name}` }));
    await db.invoice.update({ where: { id: i.id }, data: { remindedAt: now } }); }
  return due.length;
}
