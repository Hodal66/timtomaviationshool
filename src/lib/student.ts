import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { notifyApplicant, type Msg } from "./notify";
import { ensureGroup } from "./teaching";
import { cleanPhone } from "./apply";
import { LETTER_TYPES } from "./docs";
import { SITE } from "./site";

export const REQUEST_TYPES = ["PROFILE_CHANGE", "SESSION_CHANGE", "LETTER"] as const;
export const TICKET_CATEGORIES = ["General", "Admissions", "Finance", "Academic", "Technical"] as const;
const first = (n: string) => n.split(" ")[0];
const say = (subject: string, body: string) => (a: { fullName: string }): Msg => ({ template: "student_service", subject, text: `Hello ${first(a.fullName)},\n\n${body}\n${SITE.url}/me\n\n${SITE.name}` });

/* ---------- STU-12: digital ID ---------- */
const sig = (id: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "").update("id|" + id).digest("hex").slice(0, 16);
export const idToken = (applicantId: string) => `${applicantId}.${sig(applicantId)}`;
export function readIdToken(token: string): string | null { const [id, s] = (token ?? "").split("."); if (!id || !s) return null; const a = Buffer.from(s), b = Buffer.from(sig(id)); return a.length === b.length && timingSafeEqual(a, b) ? id : null; }

/* ---------- STU-02: profile ---------- */
/** Contact details change at once. Name and date of birth are identity data, so they go through a request that staff approve. */
export async function updateProfile(applicantId: string, d: { phone?: string; emergencyName?: string; emergencyPhone?: string; schoolEmail?: string }): Promise<string | null> {
  const phone = cleanPhone(d.phone), ePhone = cleanPhone(d.emergencyPhone), eName = (d.emergencyName ?? "").trim().slice(0, 120);
  if (phone && phone.replace(/\D/g, "").length < 9) return "That phone number looks too short."; if (ePhone && ePhone.replace(/\D/g, "").length < 9) return "The emergency contact phone number looks too short.";
  if ((eName && !ePhone) || (!eName && ePhone)) return "Give both the name and the phone number of your emergency contact.";
  const school = d.schoolEmail === undefined ? undefined : d.schoolEmail.trim().toLowerCase().slice(0, 160); if (school && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(school)) return "The School Google account is not a valid email address.";
  await db.applicant.update({ where: { id: applicantId }, data: { ...(phone ? { phone } : {}), emergencyName: eName || null, emergencyPhone: ePhone || null, ...(school === undefined ? {} : { schoolEmail: school || null }), events: { create: { type: "SYSTEM", actorName: "Student", message: "Updated contact details." } } } });
  return null;
}

/* ---------- STU-03, STU-06: requests ---------- */
export type RequestInput = { type: string; reason?: string; fullName?: string; dob?: string; session?: string; branchId?: string; letter?: string; addressedTo?: string };
export async function createRequest(applicantId: string, r: RequestInput): Promise<string | null> {
  const a = await db.applicant.findUnique({ where: { id: applicantId } }); if (!a) return "Application not found.";
  if (a.status !== "ENROLLED") return "This is available once you are enrolled.";
  const reason = (r.reason ?? "").trim().slice(0, 600); let detail: Record<string, string> = {};
  if (r.type === "PROFILE_CHANGE") { const fullName = (r.fullName ?? "").trim().slice(0, 120), dob = r.dob ?? ""; if (!fullName && !dob) return "Enter the new name or date of birth."; if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(+new Date(dob)))) return "Check the date of birth."; if (!reason) return "Explain why the change is needed, for example a spelling mistake."; detail = { ...(fullName ? { fullName } : {}), ...(dob ? { dob } : {}) }; }
  else if (r.type === "SESSION_CHANGE") { const session = r.session === "WEEKDAY" || r.session === "WEEKEND" ? r.session : ""; const branchId = r.branchId && r.branchId !== a.branchId ? r.branchId : ""; if (branchId && !(await db.branch.findUnique({ where: { id: branchId } }))) return "Choose a branch.";
    if ((!session || session === a.session) && !branchId) return "Choose a different schedule or branch."; if (!reason) return "Tell us why you need the change."; detail = { ...(session && session !== a.session ? { session } : {}), ...(branchId ? { branchId } : {}) }; }
  else if (r.type === "LETTER") { if (!(r.letter && r.letter in LETTER_TYPES)) return "Choose the kind of letter."; if (!reason) return "Say what the letter is for."; detail = { letter: r.letter, addressedTo: (r.addressedTo ?? "").trim().slice(0, 160) || "To whom it may concern" }; }
  else return "Unknown request.";
  if (await db.studentRequest.count({ where: { applicantId, type: r.type, status: "PENDING" } }) >= (r.type === "LETTER" ? 3 : 1)) return "You already have a request of this kind waiting for a decision.";
  await db.studentRequest.create({ data: { applicantId, type: r.type, detail, reason } });
  await db.applicationEvent.create({ data: { applicantId, type: "SYSTEM", actorName: "Student", message: `Request sent: ${r.type.replace(/_/g, " ").toLowerCase()}.` } });
  return null;
}
/** Staff decision. Approving a profile or session change applies it; approving a letter makes it downloadable. */
export async function decideRequest(id: string, approve: boolean, actor: string, note?: string): Promise<string | null> {
  const r = await db.studentRequest.findUnique({ where: { id }, include: { applicant: true } }); if (!r) return "Request not found."; if (r.status !== "PENDING") return "This request was already decided.";
  const d = r.detail as Record<string, string>; const n = (note ?? "").trim().slice(0, 400); if (!approve && !n) return "Give the student a reason when you refuse a request.";
  if (approve && r.type === "PROFILE_CHANGE") await db.applicant.update({ where: { id: r.applicantId }, data: { ...(d.fullName ? { fullName: d.fullName } : {}), ...(d.dob ? { dateOfBirth: new Date(d.dob + "T00:00:00Z") } : {}) } });
  if (approve && r.type === "SESSION_CHANGE") { const next = { programmeId: r.applicant.programmeId, intakeId: r.applicant.intakeId, branchId: d.branchId ?? r.applicant.branchId, session: (d.session ?? r.applicant.session) as "WEEKDAY" | "WEEKEND" }; const g = await ensureGroup(next); await db.applicant.update({ where: { id: r.applicantId }, data: { session: next.session, branchId: next.branchId, classGroupId: g.id } }); }
  await db.studentRequest.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", decidedBy: actor, decidedAt: new Date(), note: n || null } });
  const what = r.type === "LETTER" ? LETTER_TYPES[d.letter as keyof typeof LETTER_TYPES] ?? "letter" : r.type.replace(/_/g, " ").toLowerCase();
  await db.applicationEvent.create({ data: { applicantId: r.applicantId, type: "SYSTEM", actorName: actor, message: `Request ${approve ? "approved" : "refused"}: ${what}.${n ? " " + n : ""}` } });
  await notifyApplicant(r.applicantId, say(`Your request was ${approve ? "approved" : "not approved"}`, `Your request (${what}) was ${approve ? "approved" : "not approved"}.${n ? "\nNote from the School: " + n : ""}${approve && r.type === "LETTER" ? "\nYou can download the letter from your dashboard." : ""}`));
  return null;
}

/* ---------- STU-11: support tickets ---------- */
export async function openTicket(applicantId: string, subjectRaw: string, category: string, bodyRaw: string, author: string): Promise<string | null> {
  const subject = (subjectRaw ?? "").trim().slice(0, 140), body = (bodyRaw ?? "").trim().slice(0, 2000); if (subject.length < 4 || body.length < 4) return "Write a subject and your question.";
  if (!TICKET_CATEGORIES.includes(category as "General")) return "Choose a category."; if (await db.ticket.count({ where: { applicantId, status: { not: "CLOSED" } } }) >= 5) return "You have 5 open requests for help. Wait for an answer or close one first.";
  await db.ticket.create({ data: { applicantId, subject, category, messages: { create: { author, body } } } }); return null;
}
export async function replyTicket(ticketId: string, bodyRaw: string, by: { staff: string } | { applicantId: string; name: string }): Promise<string | null> {
  const body = (bodyRaw ?? "").trim().slice(0, 2000); if (body.length < 2) return "Write a message."; const t = await db.ticket.findUnique({ where: { id: ticketId } }); if (!t) return "Not found.";
  const staff = "staff" in by; if (!staff && t.applicantId !== by.applicantId) return "Not found."; if (t.status === "CLOSED") return "This conversation is closed. Open a new one if you still need help.";
  await db.ticket.update({ where: { id: ticketId }, data: { status: staff ? "ANSWERED" : "OPEN", updatedAt: new Date(), messages: { create: { author: staff ? by.staff : by.name, fromStaff: staff, body } } } });
  if (staff) await notifyApplicant(t.applicantId, say(`Answer to your question: ${t.subject}`, `The School answered your question "${t.subject}":\n\n${body}\n\nYou can reply or rate the answer on your dashboard.`));
  return null;
}
/** The student closes the conversation with a rating from 1 to 5. Only answered tickets can be rated. */
export async function rateTicket(ticketId: string, applicantId: string, rating: number): Promise<string | null> {
  const t = await db.ticket.findUnique({ where: { id: ticketId } }); if (!t || t.applicantId !== applicantId) return "Not found."; if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Choose a rating from 1 to 5.";
  if (t.status !== "ANSWERED") return "You can rate once the School has answered."; await db.ticket.update({ where: { id: ticketId }, data: { rating, status: "CLOSED", updatedAt: new Date() } }); return null;
}
