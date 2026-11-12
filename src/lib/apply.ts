/** Application rules shared by the browser wizard and the server. Pure code, no database. */
export const DOC_KINDS = ["National ID or passport", "Passport-size photo", "A2 certificate or transcripts"] as const;
export const EDU_LEVELS = ["Secondary school certificate (A2)", "Advanced diploma", "Bachelor's degree", "Postgraduate degree", "Other"] as const;
export const MAX_UPLOAD = 4 * 1024 * 1024;
export const UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export type ApplyData = {
  course?: string; offering?: string;
  fullName?: string; phone?: string; email?: string; dob?: string; guardianName?: string; guardianPhone?: string;
  educationLevel?: string; institution?: string; completionYear?: string;
};
export type Errors = Partial<Record<keyof ApplyData, string>>;

export const ageOf = (dob?: string) => (dob ? (Date.now() - +new Date(dob + "T00:00:00Z")) / (365.25 * 864e5) : NaN);
export const cleanPhone = (v?: string) => (v ?? "").replace(/[^\d+]/g, "");

export function validate(d: ApplyData, step: "programme" | "details" | "education" | "all"): Errors {
  const e: Errors = {};
  if (step === "programme" || step === "all") {
    if (!d.course) e.course = "Choose a programme.";
    else if (!d.offering) e.offering = "Choose an intake.";
  }
  if (step === "details" || step === "all") {
    if (!d.fullName?.trim()) e.fullName = "Enter your full name.";
    const phone = cleanPhone(d.phone), email = d.email?.trim() ?? "";
    if (!phone && !email) { e.phone = "Enter a phone number or an email address."; }
    if (phone && (phone.replace(/\D/g, "").length < 9)) e.phone = "That phone number looks too short.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "That email address does not look right.";
    const age = ageOf(d.dob);
    if (!d.dob || Number.isNaN(age)) e.dob = "Enter your date of birth.";
    else if (age < 14 || age > 90) e.dob = "Check your date of birth.";
    else if (age < 18) {
      if (!d.guardianName?.trim()) e.guardianName = "A parent or guardian name is required under 18.";
      if (cleanPhone(d.guardianPhone).replace(/\D/g, "").length < 9) e.guardianPhone = "Enter the guardian's phone number.";
    }
  }
  if (step === "education" || step === "all") {
    if (!d.educationLevel) e.educationLevel = "Choose your highest completed level.";
    if (!d.institution?.trim()) e.institution = "Enter the school or institution.";
    const y = Number(d.completionYear);
    if (!Number.isInteger(y) || y < 1970 || y > new Date().getFullYear() + 1) e.completionYear = "Enter a year, for example 2024.";
  }
  return e;
}
