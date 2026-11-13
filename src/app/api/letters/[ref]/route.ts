import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { getApplicantEmail } from "@/lib/otp";
import { buildAdmissionLetter, LETTER_STAGES } from "@/lib/letter";

/** The admission letter PDF. Staff who may view applicants, or the applicant (verified email), once admitted. */
export async function GET(_: Request, { params }: { params: Promise<{ ref: string }> }) {
  const ref = decodeURIComponent((await params).ref).toUpperCase();
  const [s, email] = await Promise.all([getSession(), getApplicantEmail()]);
  if (!s && !email) return new Response("Forbidden", { status: 403 });
  const a = await db.applicant.findUnique({ where: { reference: ref }, include: { programme: true, branch: true, intake: true } });
  const staff = !!s && can.viewApplicants(s.role);
  if (!a || !(staff || (email && a.email === email))) return new Response("Not found", { status: 404 });
  if (!LETTER_STAGES.includes(a.status)) return new Response("The admission letter is available once the applicant is admitted.", { status: 409 });
  const pdf = await buildAdmissionLetter({ reference: ref, fullName: a.fullName, programme: a.programme.name, qualification: a.programme.qualificationType, branch: a.branch.name, intake: a.intake.label, startsOn: a.intake.startsOn,
    session: a.session === "WEEKDAY" ? "Weekday (Monday to Friday)" : "Weekend (Saturday and Sunday, 9:00 AM to 2:00 PM)", admittedAt: a.admittedAt ?? new Date(), feeRwf: a.programme.feeRwf, requirements: a.requirementsMet });
  return new Response(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="Admission-letter-${ref}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
