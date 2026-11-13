import { db } from "./db";
import { buildDoc, LETTER_TYPES, day, type LetterType } from "./docs";
import { buildAdmissionLetter, LETTER_STAGES } from "./letter";
import { balanceOf, paidOn } from "./finance";
import { money } from "./format";
import { SITE } from "./site";
import { resultsFor } from "./assessment";
import { buildCertificate } from "./certificates";

const full = (id: string) => db.applicant.findUnique({ where: { id }, include: { programme: true, branch: true, intake: true, classGroup: true, invoices: { include: { payments: true }, orderBy: { createdAt: "asc" } }, requests: { where: { type: "LETTER", status: "APPROVED" } } } });
type A = NonNullable<Awaited<ReturnType<typeof full>>>;
const sess = (a: A) => (a.session === "WEEKDAY" ? "weekday (Monday to Friday)" : "weekend (Saturday and Sunday)");
export type DocFile = { name: string; bytes: Uint8Array };

export const enrolmentLetter = (a: A) => buildDoc({ docId: `ENR-${a.reference}`, title: "Confirmation of enrolment", date: new Date(), salutation: "To whom it may concern,",
  paragraphs: [`This is to confirm that ${a.fullName}${a.dateOfBirth ? `, born on ${day(a.dateOfBirth)},` : ""} is enrolled as a student of ${SITE.name}.`, `Programme: ${a.programme.name}. Branch: ${a.branch.name}. Intake: ${a.intake.label}. Schedule: ${sess(a)}.${a.classGroup ? ` Class group: ${a.classGroup.name}.` : ""} Student reference: ${a.reference}.`, "This confirmation is issued at the student's request and reflects the School's records on the date above."] });
export const statement = (a: A) => { const b = balanceOf(a.invoices); return buildDoc({ docId: `STM-${a.reference}`, title: "Statement of account", office: "Finance Office", signatory: "Finance Office", date: new Date(),
  paragraphs: [`Student: ${a.fullName} (${a.reference}). Programme: ${a.programme.name}.`], table: { head: ["Invoice", "Description", "Due", "Amount", "Paid", "Status"], widths: [110, 165, 62, 62, 55, 45], rows: a.invoices.filter((i) => i.status !== "CANCELLED").map((i) => [i.reference, i.description, i.dueOn?.toISOString().slice(0, 10) ?? "-", money(i.amountMinor, "RWF"), money(Math.min(i.amountMinor, paidOn(i)), "RWF"), i.status === "PAID" ? "Paid" : "Open"]) },
  footer: `Total billed: ${money(b.billed, "RWF")}. Total paid and confirmed: ${money(b.paid, "RWF")}. Balance due: ${money(b.balance, "RWF")}. Payments reported but not yet confirmed by Finance are not included.` }); };
export function requestedLetter(a: A, r: A["requests"][number]) { const d = r.detail as { letter: LetterType; addressedTo?: string }; const title = LETTER_TYPES[d.letter] ?? "Official letter";
  const body: Record<string, string[]> = {
    RECOMMENDATION: [`${a.fullName} is a student of ${SITE.name}, enrolled in ${a.programme.name} at our ${a.branch.name} branch (${a.intake.label} intake).`, "On the basis of the School's records, we are pleased to recommend this student. The School remains available to confirm any information in this letter."],
    VISA: [`We confirm that ${a.fullName}${a.dateOfBirth ? `, born on ${day(a.dateOfBirth)},` : ""} is a registered student of ${SITE.name}, enrolled in ${a.programme.name} (${a.intake.label} intake, ${sess(a)}).`, "This letter is issued to support the student's visa or travel document application. It does not constitute a financial guarantee by the School."],
    INTERNSHIP: [`We introduce ${a.fullName}, a student of ${SITE.name} enrolled in ${a.programme.name}.`, "The student is seeking an internship placement as part of their training. We would be grateful for any opportunity you can offer and remain available for further information."],
    OTHER: [`This letter concerns ${a.fullName}, a student of ${SITE.name} enrolled in ${a.programme.name} (${a.intake.label} intake).`, r.reason ?? ""] };
  return buildDoc({ docId: `LTR-${r.id}`, title, date: r.decidedAt ?? new Date(), salutation: (d.addressedTo || "To whom it may concern") + ",", paragraphs: body[d.letter] ?? body.OTHER, footer: `Approved by ${r.decidedBy ?? "the School"}. Student reference: ${a.reference}.` }); }

/** Everything the student may download right now (STU-05). kind: admission | enrolment | statement | letter. */
export async function studentDoc(applicantId: string, kind: string, id?: string): Promise<DocFile | string> {
  const a = await full(applicantId); if (!a || !a.reference) return "Not found.";
  if (kind === "admission") { if (!LETTER_STAGES.includes(a.status)) return "Available once you are admitted."; return { name: `Admission-letter-${a.reference}.pdf`, bytes: await buildAdmissionLetter({ reference: a.reference, fullName: a.fullName, programme: a.programme.name, qualification: a.programme.qualificationType, branch: a.branch.name, intake: a.intake.label, startsOn: a.intake.startsOn, session: sess(a), admittedAt: a.admittedAt ?? new Date(), feeRwf: a.programme.feeRwf, requirements: a.requirementsMet }) }; }
  if (kind === "enrolment") { if (a.status !== "ENROLLED") return "Available once you are enrolled."; return { name: `Enrolment-confirmation-${a.reference}.pdf`, bytes: await enrolmentLetter(a) }; }
  if (kind === "statement") { if (!a.invoices.length) return "You have no invoices yet."; return { name: `Statement-${a.reference}.pdf`, bytes: await statement(a) }; }
  if (kind === "letter") { const r = a.requests.find((x) => x.id === id); if (!r) return "That letter is not approved yet."; return { name: `${(LETTER_TYPES[(r.detail as { letter: LetterType }).letter] ?? "Letter").replace(/\s+/g, "-")}-${a.reference}.pdf`, bytes: await requestedLetter(a, r) }; }
  if (kind === "transcript") { const r = await resultsFor(a.id); if (!r || !r.rows.some((x) => x.grade)) return "No published results yet.";
    return { name: `Transcript-${a.reference}.pdf`, bytes: await buildDoc({ docId: `TRN-${a.reference}`, title: r.result.complete ? "Academic transcript" : "Provisional transcript", office: "Academic Office", signatory: "Head of Academics", date: new Date(), paragraphs: [`Student: ${a.fullName} (${a.reference}). Programme: ${a.programme.name}. Branch: ${a.branch.name}. Intake: ${a.intake.label}.`],
      table: { head: ["Assessment", "Part of the final mark", "Date", "Score", "%"], widths: [190, 150, 62, 55, 42], rows: r.rows.filter((x) => x.grade).map((x) => [x.title, x.component, x.heldOn?.toISOString().slice(0, 10) ?? "-", `${x.grade!.score} / ${x.maxScore}`, String(Math.round((x.grade!.score / x.maxScore) * 1000) / 10)]) },
      footer: r.parts_text + ` ${r.result.complete ? `Final mark: ${r.result.overall}%. Pass mark: ${r.scheme.passMark}%. Result: ${r.result.passed ? "PASS" : "NOT PASSED"}.` : `Provisional mark so far: ${r.result.overall ?? "-"}%. Not every part of the grading scheme has a published result yet.`}` }) }; }
  if (kind === "certificate") { const c = await db.certificate.findFirst({ where: { number: id ?? "", holderId: a.id, status: "VALID" }, include: { programme: true } }); if (!c) return "Certificate not found.";
    return { name: `Certificate-${c.number}.pdf`, bytes: await buildCertificate({ number: c.number, kind: c.kind, holder: a.fullName, programme: c.programme.name, issuedOn: c.issuedOn, finalMark: c.finalMark, replacesNumber: c.replacesNumber }) }; }
  return "Unknown document.";
}
export async function allStudentDocs(applicantId: string): Promise<DocFile[]> {
  const a = await full(applicantId); if (!a) return []; const out: DocFile[] = [];
  const certs = await db.certificate.findMany({ where: { holderId: a.id, status: "VALID" }, select: { number: true } });
  for (const [k, id] of [["admission"], ["enrolment"], ["statement"], ["transcript"], ...certs.map((c) => ["certificate", c.number]), ...a.requests.map((r) => ["letter", r.id])] as [string, string?][]) { const d = await studentDoc(applicantId, k, id); if (typeof d !== "string") out.push(d); }
  const ups = await db.upload.findMany({ where: { applicantId } }); for (const u of ups) out.push({ name: `uploaded/${u.kind.replace(/[^\w]+/g, "-")}-${u.filename}`, bytes: new Uint8Array(u.data) });
  return out;
}
/** For /verify: what a document code confirms. */
export async function describeDoc(docId: string): Promise<string | null> {
  const o = docId.match(/^OFFER-(TAS-J-[0-9A-F]+)$/); if (o) { const j = await db.jobApplication.findUnique({ where: { reference: o[1] }, include: { vacancy: true } }); return j?.offer ? `Offer of engagement to ${j.fullName} as ${j.vacancy.title}${j.status === "WITHDRAWN" ? " (withdrawn)" : ""}.` : null; }
  const m = docId.match(/^(ENR|STM|LTR|TRN)-(.+)$/); if (!m) return null;
  if (m[1] === "LTR") { const r = await db.studentRequest.findUnique({ where: { id: m[2] }, include: { applicant: { include: { programme: true } } } }); if (!r || r.status !== "APPROVED" || r.type !== "LETTER") return null; return `${LETTER_TYPES[(r.detail as { letter: LetterType }).letter] ?? "Letter"} issued for ${r.applicant.fullName}, student of ${r.applicant.programme.name}, approved on ${day(r.decidedAt ?? r.createdAt)}.`; }
  const a = await db.applicant.findUnique({ where: { reference: m[2] }, include: { programme: true, branch: true } }); if (!a) return null;
  if (m[1] === "TRN") return `Transcript for ${a.fullName} (${a.reference}), ${a.programme.name}. Ask the student for a fresh copy to see current results.`;
  return m[1] === "ENR" ? (a.status === "ENROLLED" ? `${a.fullName} is currently enrolled in ${a.programme.name}, ${a.branch.name} branch.` : `${a.fullName} is not currently enrolled.`) : `Statement of account for ${a.fullName} (${a.reference}). Ask the student for a fresh copy: balances change as payments are confirmed.`;
}
