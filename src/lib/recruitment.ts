import { randomBytes } from "node:crypto";
import { db } from "./db";
import { slugify } from "./catalogue";
import { createLecturer, MANAGERS, type Actor } from "./lecturers";
import { buildDoc } from "./docs";
import { emailConfigured, sendEmail } from "./notify";
import { kigaliDate } from "./teaching";
import { SITE } from "./site";

export const CV_MAX = 4 * 1024 * 1024;
export const CV_TYPES: Record<string, (b: Uint8Array) => boolean> = {
  "application/pdf": (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  // DOCX is a ZIP container.
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
};
/** Pipeline (LEC-08). REJECTED and WITHDRAWN end it from any open stage. */
export const JOB_STAGES = ["NEW", "SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED"] as const;
const NEXT: Record<string, string[]> = { NEW: ["SHORTLISTED", "REJECTED"], SHORTLISTED: ["INTERVIEW", "REJECTED"], INTERVIEW: ["REJECTED"], OFFERED: ["WITHDRAWN", "REJECTED"] };
/** LEC-10: what must be done before the new lecturer teaches. */
export const ONBOARDING = ["Signed contract received", "National ID copy", "Bank or MoMo details", "Certificates verified", "Induction completed", "Timetable assigned"] as const;
type Hist = { at: string; by: string; action: string; note?: string };
export type Offer = { rate: number; payModel: string; currency: string; startDate: string; subjects: string[]; docId: string };
const h = (by: string, action: string, note?: string): Hist => ({ at: new Date().toISOString(), by, action, ...(note ? { note } : {}) });
const lines = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(/\r?\n|;/)).map((x) => String(x).trim()).filter(Boolean).slice(0, 15).map((x) => x.slice(0, 200));

export type VacancyInput = { title?: string; description?: string; subjects?: string; requirements?: string; branchId?: string; payModel?: string; closesOn?: string };
/** LEC-07: create or edit a vacancy. New vacancies start as drafts. */
export async function saveVacancy(a: Actor, d: VacancyInput, id?: string): Promise<string | { id: string }> {
  if (!MANAGERS.includes(a.role)) return "Not allowed."; const title = (d.title ?? "").trim().slice(0, 120), description = (d.description ?? "").trim().slice(0, 4000);
  if (title.length < 3) return "Enter a title."; if (description.length < 20) return "Describe the role in at least 20 characters.";
  if (d.payModel && !["HOUR", "SESSION", "MODULE", "MONTHLY"].includes(d.payModel)) return "Unknown pay model.";
  const closesOn = d.closesOn ? new Date(d.closesOn + "T00:00:00Z") : null; if (closesOn && (isNaN(+closesOn) || +closesOn < +kigaliDate())) return "The closing date must be today or later.";
  const data = { title, description, subjects: lines((d.subjects ?? "").replace(/,/g, ";")), requirements: lines(d.requirements), branchId: d.branchId || null, payModel: d.payModel || "HOUR", closesOn, updatedAt: new Date() };
  if (id) { const v = await db.vacancy.update({ where: { id }, data }).catch(() => null); return v ? { id: v.id } : "Vacancy not found."; }
  const v = await db.vacancy.create({ data: { ...data, slug: `${slugify(title)}-${randomBytes(2).toString("hex")}`, createdBy: a.name } }); return { id: v.id };
}
export async function setVacancyStatus(a: Actor, id: string, status: "DRAFT" | "PUBLISHED" | "CLOSED"): Promise<string | null> {
  if (!MANAGERS.includes(a.role)) return "Not allowed."; if (!["DRAFT", "PUBLISHED", "CLOSED"].includes(status)) return "Unknown status.";
  const v = await db.vacancy.findUnique({ where: { id } }); if (!v) return "Vacancy not found."; if (status === "PUBLISHED" && v.closesOn && +v.closesOn < +kigaliDate()) return "Change the closing date before publishing.";
  await db.vacancy.update({ where: { id }, data: { status, updatedAt: new Date() } }); return null;
}
/** Vacancies open to applicants: published and not past the closing date. */
export const openVacancies = () => db.vacancy.findMany({ where: { status: "PUBLISHED", OR: [{ closesOn: null }, { closesOn: { gte: kigaliDate() } }] }, include: { branch: true }, orderBy: { createdAt: "desc" } });
export const openVacancy = (slug: string) => db.vacancy.findFirst({ where: { slug, status: "PUBLISHED", OR: [{ closesOn: null }, { closesOn: { gte: kigaliDate() } }] }, include: { branch: true } });

/** LEC-08: a public application with CV. Screening: one yes/no answer per requirement gives a starting score (share of requirements met). */
export async function applyForJob(slug: string, d: { fullName?: string; email?: string; phone?: string; coverNote?: string; answers?: Record<string, string> }, cv: { name: string; type: string; bytes: Uint8Array } | null): Promise<string | { reference: string }> {
  const v = await openVacancy(slug); if (!v) return "This vacancy is closed.";
  const fullName = (d.fullName ?? "").trim().slice(0, 80), email = (d.email ?? "").trim().toLowerCase(), phone = (d.phone ?? "").replace(/[^\d+]/g, "");
  if (fullName.length < 3) return "Enter your full name."; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address."; if (phone.replace(/\D/g, "").length < 9) return "Enter a valid phone number.";
  if (!cv || !cv.bytes.length) return "Attach your CV."; if (cv.bytes.length > CV_MAX) return "The CV is larger than 4 MB."; if (!CV_TYPES[cv.type]) return "Upload the CV as PDF or Word (DOCX)."; if (!CV_TYPES[cv.type](cv.bytes)) return "That file does not look like a real PDF or DOCX.";
  const answers = Object.fromEntries(v.requirements.map((r, i) => [r, d.answers?.[String(i)] === "yes" ? "yes" : "no"])); const score = v.requirements.length ? Math.round((Object.values(answers).filter((x) => x === "yes").length / v.requirements.length) * 100) : null;
  if (await db.jobApplication.findUnique({ where: { vacancyId_email: { vacancyId: v.id, email } } })) return "You already applied for this vacancy with this email.";
  const reference = "TAS-J-" + randomBytes(3).toString("hex").toUpperCase();
  await db.jobApplication.create({ data: { vacancyId: v.id, reference, fullName, email, phone, coverNote: (d.coverNote ?? "").trim().slice(0, 2000) || null, answers, score, cvName: cv.name.replace(/[^\w.\- ]/g, "_").slice(0, 120), cvMime: cv.type, cvSize: cv.bytes.length, cv: new Uint8Array(cv.bytes), history: [h(fullName, "Applied")] as never } });
  if (emailConfigured()) await sendEmail(email, `We received your application ${reference}`, `Hello ${fullName.split(" ")[0]},\n\nThank you for applying for "${v.title}" at ${SITE.name}. Your reference is ${reference}. We will contact you if you are shortlisted.\n\n${SITE.name}\n${SITE.phoneDisplay}`).catch(() => null);
  return { reference };
}
/** Move an application along the pipeline with a note; rejection needs a reason. */
export async function moveJobApp(a: Actor, id: string, to: string, note?: string, score?: number | null): Promise<string | null> {
  if (!MANAGERS.includes(a.role)) return "Not allowed."; const j = await db.jobApplication.findUnique({ where: { id } }); if (!j) return "Application not found.";
  const n = (note ?? "").trim().slice(0, 500); if (!(NEXT[j.status] ?? []).includes(to)) return `An application at "${j.status.toLowerCase()}" cannot move to "${to.toLowerCase()}".`; if (to === "REJECTED" && !n) return "Give a reason for the rejection.";
  if (score != null && (!Number.isInteger(score) || score < 0 || score > 100)) return "The score is a whole number from 0 to 100.";
  await db.jobApplication.update({ where: { id }, data: { status: to, ...(score != null ? { score } : {}), history: [...(j.history as Hist[]), h(a.name, to === "REJECTED" ? "Rejected" : to === "WITHDRAWN" ? "Offer withdrawn" : `Moved to ${to.toLowerCase()}`, n)] as never, updatedAt: new Date() } });
  return null;
}
/** LEC-10: offer after the interview. The offer letter is a verifiable School document. */
export async function makeOffer(a: Actor, id: string, d: { rate?: string; payModel?: string; currency?: string; startDate?: string; subjects?: string }): Promise<string | null> {
  if (!MANAGERS.includes(a.role)) return "Not allowed."; const j = await db.jobApplication.findUnique({ where: { id }, include: { vacancy: true } }); if (!j) return "Application not found."; if (j.status !== "INTERVIEW") return "Interview the candidate before making an offer.";
  const rate = Number(d.rate); if (!Number.isInteger(rate) || rate <= 0) return "Enter the rate as a whole number."; const payModel = d.payModel || j.vacancy.payModel; if (!["HOUR", "SESSION", "MODULE", "MONTHLY"].includes(payModel)) return "Unknown pay model.";
  const currency = d.currency || "RWF"; if (!["RWF", "USD"].includes(currency)) return "The currency is RWF or USD."; const start = new Date((d.startDate ?? "") + "T00:00:00Z"); if (isNaN(+start)) return "Choose a start date.";
  const offer: Offer = { rate, payModel, currency, startDate: start.toISOString().slice(0, 10), subjects: lines((d.subjects || j.vacancy.subjects.join(";")).replace(/,/g, ";")), docId: `OFFER-${j.reference}` };
  await db.jobApplication.update({ where: { id }, data: { status: "OFFERED", offer: offer as never, history: [...(j.history as Hist[]), h(a.name, "Offer made", `${currency} ${rate.toLocaleString("en-US")} per ${payModel.toLowerCase()}, from ${offer.startDate}`)] as never, updatedAt: new Date() } }); return null;
}
const per: Record<string, string> = { HOUR: "per teaching hour", SESSION: "per session", MODULE: "per module", MONTHLY: "per month" };
export async function offerLetter(id: string): Promise<{ name: string; pdf: Uint8Array } | null> {
  const j = await db.jobApplication.findUnique({ where: { id }, include: { vacancy: { include: { branch: true } } } }); const o = j?.offer as Offer | null; if (!j || !o) return null;
  const pdf = await buildDoc({ docId: o.docId, title: "Offer of engagement", office: "Academic Office", date: j.updatedAt, salutation: `Dear ${j.fullName},`, paragraphs: [
    `Following your application (${j.reference}) and interview, ${SITE.name} is pleased to offer you an engagement as ${j.vacancy.title}${j.vacancy.branch ? ` at our ${j.vacancy.branch.name} branch` : ""}.`,
    `Start date: ${o.startDate}. Subjects: ${o.subjects.join(", ") || "as agreed with the Academic Office"}. Remuneration: ${o.currency} ${o.rate.toLocaleString("en-US")} ${per[o.payModel] ?? ""}, paid monthly on approved claims supported by lesson reports and attendance registers.`,
    "This offer is subject to the signed contract, a copy of your national ID, verified certificates and your bank or mobile money details. Please confirm your acceptance by replying to the Academic Office within 7 days."],
    signatory: "Head of Academics" });
  return { name: `${o.docId}.pdf`, pdf };
}
/** Accepting the offer creates the lecturer account and profile and starts the onboarding checklist. */
export async function hire(a: Actor, id: string, password: string): Promise<string | { userId: string }> {
  if (!MANAGERS.includes(a.role)) return "Not allowed."; const j = await db.jobApplication.findUnique({ where: { id }, include: { vacancy: true } }); if (!j) return "Application not found."; if (j.status !== "OFFERED") return "Make an offer first."; const o = j.offer as Offer;
  const r = await createLecturer(a, { name: j.fullName, email: j.email, password, phone: j.phone, subjects: o.subjects.join(", "), rate: String(o.rate), payModel: o.payModel, currency: o.currency, contractStart: o.startDate } as never); if (typeof r === "string") return r;
  await db.jobApplication.update({ where: { id }, data: { status: "HIRED", userId: r.id, onboarding: Object.fromEntries(ONBOARDING.map((x) => [x, null])) as never, history: [...(j.history as Hist[]), h(a.name, "Offer accepted, lecturer account created")] as never, updatedAt: new Date() } }); return { userId: r.id };
}
export async function tickOnboarding(a: Actor, id: string, item: string, done: boolean): Promise<string | null> {
  if (!MANAGERS.includes(a.role)) return "Not allowed."; if (!(ONBOARDING as readonly string[]).includes(item)) return "Unknown checklist item."; const j = await db.jobApplication.findUnique({ where: { id } }); if (!j || j.status !== "HIRED") return "Onboarding starts after hiring.";
  const ob = { ...((j.onboarding as Record<string, unknown>) ?? {}), [item]: done ? { by: a.name, at: new Date().toISOString() } : null };
  await db.jobApplication.update({ where: { id }, data: { onboarding: ob as never, history: [...(j.history as Hist[]), h(a.name, `${done ? "Done" : "Undone"}: ${item}`)] as never, updatedAt: new Date() } }); return null;
}
export const onboardingDone = (ob: unknown) => { const o = (ob ?? {}) as Record<string, unknown>; return ONBOARDING.filter((x) => o[x]).length; };
