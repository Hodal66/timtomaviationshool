import { db } from "./db";
import { ensureIntake } from "./intakes";
import { newReference } from "./reference";
import { readUtm, record } from "./track";
import { ageOf, cleanPhone, validate, type ApplyData } from "./apply";
import { DOC_KINDS } from "./apply";
import { revalidatePath } from "next/cache";

export type Result = { ok: true; reference: string } | { ok: false; error: string; field?: string };

/** The single place an application is created. Everything is re-validated here; nothing from the browser is trusted. */
export async function createApplication(d: ApplyData, o: { draftId?: string; cookieUtm?: string; lang?: string | null }): Promise<Result> {
  const errs = validate(d, "all");
  const first = Object.entries(errs)[0];
  if (first) return { ok: false, field: first[0], error: first[1]! };

  const programme = await db.programme.findFirst({ where: { slug: d.course, status: "PUBLISHED" } });
  if (!programme) return { ok: false, field: "course", error: "This programme is not open for applications." };
  const branch = await db.branch.findUnique({ where: { id: d.branch } });
  if (!branch) return { ok: false, field: "branch", error: "Choose the branch where you want to study." };
  const intake = await ensureIntake(d.start);
  if (!intake) return { ok: false, field: "start", error: "Choose a start date from the list." };

  const email = (d.email ?? "").trim().toLowerCase(), phone = cleanPhone(d.phone), dob = new Date(d.dob + "T00:00:00Z");
  const minor = ageOf(d.dob) < 18;
  // One live application per person per programme. Rejected applicants may apply again.
  const dupe = await db.applicant.findFirst({ where: { programmeId: programme.id, status: { not: "REJECTED" }, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] }, select: { id: true } });
  if (dupe) return { ok: false, error: "An application with these contact details already exists for this programme. Use Track application, or contact admissions." };

  const utm = readUtm(o.cookieUtm);
  let reference = newReference();
  for (let i = 0; i < 5 && (await db.applicant.findUnique({ where: { reference }, select: { id: true } })); i++) reference = newReference();

  const uploads = o.draftId ? await db.upload.findMany({ where: { draftId: o.draftId }, select: { id: true, kind: true } }) : [];
  const regFee = programme.registrationFeeRwf;

  await db.$transaction(async (tx) => {
    const a = await tx.applicant.create({ data: {
      fullName: d.fullName!.trim().slice(0, 120), email: email || null, phone: phone || null, dateOfBirth: dob,
      source: utm?.utmSource ?? "Web", leadSource: utm?.utmSource ?? "Direct website", utmSource: utm?.utmSource ?? null, utmMedium: utm?.utmMedium ?? null, utmCampaign: utm?.utmCampaign ?? null,
      language: o.lang ?? null, reference, session: d.session as "WEEKDAY" | "WEEKEND",
      guardianName: minor ? d.guardianName!.trim().slice(0, 120) : null, guardianPhone: minor ? cleanPhone(d.guardianPhone).slice(0, 20) : null,
      educationLevel: d.educationLevel, institution: d.institution!.trim().slice(0, 160), completionYear: Number(d.completionYear),
      programmeId: programme.id, intakeId: intake.id, branchId: branch.id,
      documents: { create: DOC_KINDS.map((kind) => ({ kind, status: uploads.some((u) => u.kind === kind) ? "RECEIVED" : "PENDING" })) },
      events: { create: [{ type: "STATUS", actorName: "Website", message: "Application submitted." }, { type: "SYSTEM", actorName: "Website", message: `Submitted online${utm?.utmSource ? ` (source: ${utm.utmSource})` : ""}. ${uploads.length} of ${DOC_KINDS.length} documents uploaded.` }] },
    } });
    if (uploads.length) await tx.upload.updateMany({ where: { draftId: o.draftId }, data: { applicantId: a.id, draftId: null } });
    if (regFee) await tx.invoice.create({ data: { reference: `INV-${reference}`, applicantId: a.id, description: `Registration fee, ${programme.name}`, amountMinor: regFee, currency: "RWF" } });
    if (o.draftId) await tx.applicationDraft.delete({ where: { id: o.draftId } });
    return a;
  });

  await db.lead.create({ data: { name: d.fullName!.trim(), email: email || null, phone: phone || null, programmeId: programme.id, source: utm?.utmSource ?? "Website application", utmSource: utm?.utmSource ?? null, utmMedium: utm?.utmMedium ?? null, utmCampaign: utm?.utmCampaign ?? null, message: `Application ${reference}` } });
  await record({ type: "APPLICATION", path: "/apply", programmeId: programme.id, utmSource: utm?.utmSource, utmMedium: utm?.utmMedium, utmCampaign: utm?.utmCampaign });
  revalidatePath(`/courses/${programme.slug}`); revalidatePath("/courses");
  return { ok: true, reference };
}
