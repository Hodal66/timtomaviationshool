import { db } from "./db";
import { sessionDates, type Actor } from "./lecturers";
import { kigaliDate } from "./teaching";

export type Line = { date: string; slotId: string; subject: string; group: string; hours: number; reported: boolean; attendance: boolean; paid: boolean };
export type Clearance = { reports: boolean; attendance: boolean; grades: boolean; missingReports: number; missingAttendance: number; lateGrades: number };
export type Hist = { at: string; by: string; uid?: string; action: string; note?: string };
/** Order of the approval chain (LEC-20). Each step may return the claim to the lecturer with a comment. */
export const CHAIN = ["SUBMITTED", "COORDINATOR_APPROVED", "ACADEMIC_APPROVED", "PAID"] as const;
const STEP: Record<string, { from: string; roles: string[]; to: string }> = {
  coordinator: { from: "SUBMITTED", roles: ["BRANCH_MANAGER", "ACADEMIC", "ADMIN"], to: "COORDINATOR_APPROVED" },
  academic: { from: "COORDINATOR_APPROVED", roles: ["ACADEMIC", "ADMIN"], to: "ACADEMIC_APPROVED" },
  finance: { from: "ACADEMIC_APPROVED", roles: ["FINANCE", "ADMIN"], to: "PAID" },
};
export const periodOk = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
const bounds = (p: string) => { const [y, m] = p.split("-").map(Number); return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 0)) }; };
/** LEC-17: amount for a pay model. Per hour: hours x rate. Per session: sessions x rate. Per module: class groups taught in the month x rate. Monthly: the rate. */
export function amountFor(model: string, rate: number, lines: Line[]): { units: number; amount: number } {
  const paid = lines.filter((l) => l.paid); const units = model === "HOUR" ? Math.round(paid.reduce((n, l) => n + l.hours, 0) * 100) / 100 : model === "SESSION" ? paid.length : model === "MODULE" ? new Set(paid.map((l) => l.group)).size : paid.length ? 1 : 0;
  return { units, amount: Math.round(units * rate) };
}

/** LEC-18/19: build the month's lines from the timetable. A session is paid only when it has a lesson report AND an attendance register. */
export async function buildClaim(lecturerId: string, period: string) {
  const { from, to } = bounds(period); const end = +to > +kigaliDate() ? kigaliDate() : to;
  const slots = await db.timetableSlot.findMany({ where: { lecturerId }, include: { group: { include: { intake: true } }, lessonReports: { where: { date: { gte: from, lte: to } } } } });
  const regs = new Set((await db.classSession.findMany({ where: { slotId: { in: slots.map((s) => s.id) }, date: { gte: from, lte: to }, records: { some: {} } }, select: { slotId: true, date: true } })).map((x) => x.slotId + x.date.toISOString().slice(0, 10)));
  const lines: Line[] = slots.flatMap((s) => { const start = s.group.intake.startsOn > from ? s.group.intake.startsOn : from; const dates = new Set(sessionDates(s.dayOfWeek, start, end)); for (const r of s.lessonReports) dates.add(r.date.toISOString().slice(0, 10));
    return [...dates].sort().map((d) => { const reported = s.lessonReports.some((r) => r.date.toISOString().slice(0, 10) === d), attendance = regs.has(s.id + d); return { date: d, slotId: s.id, subject: s.subject, group: s.group.name, hours: (s.endMin - s.startMin) / 60, reported, attendance, paid: reported && attendance }; }); }).sort((a, b) => a.date.localeCompare(b.date));
  const late = await db.assessment.count({ where: { createdById: lecturerId, status: "DRAFT", heldOn: { lte: new Date(Date.now() - 14 * 864e5) } } });
  const clearance: Clearance = { missingReports: lines.filter((l) => !l.reported).length, missingAttendance: lines.filter((l) => !l.attendance).length, lateGrades: late, reports: lines.every((l) => l.reported), attendance: lines.every((l) => l.attendance), grades: late === 0 };
  return { lines, clearance };
}
export const cleared = (c: Clearance) => c.reports && c.attendance && c.grades;

/** The lecturer submits (or resubmits after a return) the claim for a month that has ended or is the current month. */
export async function submitClaim(a: Actor, period: string): Promise<string | null> {
  if (a.role !== "LECTURER") return "Only lecturers submit their own claims."; if (!periodOk(period)) return "Choose a month."; const now = kigaliDate(); const cur = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`; if (period > cur) return "You cannot claim for a future month.";
  const p = await db.lecturerProfile.findUnique({ where: { userId: a.uid } }); if (!p || p.rate <= 0) return "Your pay rate is not set. Ask the academic office.";
  const old = await db.paymentClaim.findUnique({ where: { lecturerId_period: { lecturerId: a.uid, period } } }); if (old && old.status !== "RETURNED") return "You already submitted a claim for this month.";
  const { lines, clearance } = await buildClaim(a.uid, period); const { units, amount } = amountFor(p.payModel, p.rate, lines); if (!lines.some((l) => l.paid)) return "No delivered sessions to claim: each session needs a lesson report and an attendance register.";
  const hist: Hist[] = [...((old?.history as Hist[]) ?? []), { at: new Date().toISOString(), by: a.name, uid: a.uid, action: old ? "Resubmitted" : "Submitted" }];
  const data = { payModel: p.payModel, rate: p.rate, currency: p.currency, units, amount, lines: lines as never, clearance: clearance as never, status: "SUBMITTED", history: hist as never, updatedAt: new Date() };
  if (old) await db.paymentClaim.update({ where: { id: old.id }, data }); else await db.paymentClaim.create({ data: { lecturerId: a.uid, period, ...data } }); return null;
}
/** One step of the chain, a return with a comment, or the payment by Finance. The same person may not approve two steps. Clearance must be complete before the coordinator approves. */
export async function actOnClaim(a: Actor, id: string, act: "coordinator" | "academic" | "finance" | "return" | "answer", note?: string, paidRef?: string): Promise<string | null> {
  const c = await db.paymentClaim.findUnique({ where: { id } }); if (!c) return "Claim not found."; const hist = c.history as Hist[]; const n = (note ?? "").trim().slice(0, 500);
  const staff = [...STEP.coordinator.roles, ...STEP.finance.roles];
  if (act === "answer") { if (!staff.includes(a.role)) return "Not allowed."; if (!n) return "Write the answer."; await db.paymentClaim.update({ where: { id }, data: { openQuery: false, history: [...hist, { at: new Date().toISOString(), by: a.name, uid: a.uid, action: "Answer", note: n }] as never, updatedAt: new Date() } }); return null; }
  if (act === "return") { if (!["SUBMITTED", "COORDINATOR_APPROVED", "ACADEMIC_APPROVED"].includes(c.status)) return "This claim cannot be returned now."; if (!staff.includes(a.role)) return "Not allowed."; if (!n) return "Say what the lecturer must correct.";
    await db.paymentClaim.update({ where: { id }, data: { status: "RETURNED", openQuery: false, history: [...hist, { at: new Date().toISOString(), by: a.name, uid: a.uid, action: "Returned", note: n }] as never, updatedAt: new Date() } }); return null; }
  const st = STEP[act]; if (!st.roles.includes(a.role)) return "Not allowed for your role."; if (c.status !== st.from) return "The claim is not at this step.";
  if (a.uid === c.lecturerId) return "You cannot approve your own claim."; if (hist.some((h) => h.uid === a.uid && /approved/i.test(h.action))) return "The same person cannot approve two steps of a claim.";
  if (act === "coordinator" && !cleared(c.clearance as Clearance)) return "Clearance is not complete: every session needs a lesson report and an attendance register, and marks must be submitted.";
  const ref = (paidRef ?? "").trim().slice(0, 80); if (act === "finance" && !ref) return "Enter the bank or MoMo transfer reference.";
  await db.paymentClaim.update({ where: { id }, data: { status: st.to, openQuery: false, ...(act === "finance" ? { paidRef: ref, paidAt: new Date() } : {}), history: [...hist, { at: new Date().toISOString(), by: a.name, uid: a.uid, action: act === "finance" ? `Paid (${ref})` : act === "coordinator" ? "Approved by coordinator" : "Approved by Head of Academics", ...(n ? { note: n } : {}) }] as never, updatedAt: new Date() } }); return null;
}
/** LEC-22: the lecturer raises a query on their claim; staff see it flagged until the next step. */
export async function queryClaim(a: Actor, id: string, note: string): Promise<string | null> {
  const c = await db.paymentClaim.findUnique({ where: { id } }); if (!c || c.lecturerId !== a.uid) return "Claim not found."; const n = (note ?? "").trim().slice(0, 500); if (n.length < 5) return "Write your question.";
  await db.paymentClaim.update({ where: { id }, data: { openQuery: true, history: [...(c.history as Hist[]), { at: new Date().toISOString(), by: a.name, uid: a.uid, action: "Query", note: n }] as never, updatedAt: new Date() } }); return null;
}

/** LEC-25: totals per status and month for the claims report. */
export async function claimsSummary(period?: string) {
  const rows = await db.paymentClaim.findMany({ where: period ? { period } : {}, select: { status: true, amount: true, currency: true } }); const out: Record<string, { n: number; RWF: number; USD: number }> = {};
  for (const r of rows) { const o = (out[r.status] ??= { n: 0, RWF: 0, USD: 0 }); o.n++; o[r.currency as "RWF" | "USD"] = (o[r.currency as "RWF" | "USD"] ?? 0) + r.amount; } return out;
}
