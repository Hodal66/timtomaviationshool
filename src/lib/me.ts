import { db } from "./db";
import { getApplicantEmail } from "./otp";
/** The signed-in applicant's own application record, or null. Every student endpoint goes through this ownership check. */
export async function myApplication(applicantId: unknown) {
  const email = await getApplicantEmail(); if (!email || typeof applicantId !== "string" || !applicantId) return null;
  return db.applicant.findFirst({ where: { id: applicantId, email } });
}
