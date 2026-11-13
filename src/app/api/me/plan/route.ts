import { db } from "@/lib/db";
import { getApplicantEmail } from "@/lib/otp";
import { setTuitionPlan } from "@/lib/finance";
/** STU-04: an admitted applicant chooses to pay tuition in 1, 2 or 3 installments (until the first tuition payment is recorded). */
export async function POST(req: Request) {
  const email = await getApplicantEmail(); if (!email) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const a = await db.applicant.findFirst({ where: { id: String(b?.applicantId ?? ""), email } }); if (!a) return Response.json({ ok: false, error: "Application not found." }, { status: 404 });
  const err = await setTuitionPlan(a.id, Number(b?.installments), "Applicant");
  return Response.json(err ? { ok: false, error: err } : { ok: true }, { status: err ? 400 : 200 });
}
