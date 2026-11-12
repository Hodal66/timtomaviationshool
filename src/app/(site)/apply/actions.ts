"use server";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { listOfferings } from "@/lib/offerings";
import { newReference } from "@/lib/reference";
import { readUtm, record } from "@/lib/track";
import { REQUIRED_DOCS } from "@/lib/catalogue";


export async function submitApplication(fd: FormData) {
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const back = (msg: string) => redirect(`/apply?course=${encodeURIComponent(get("course"))}&offering=${encodeURIComponent(get("offering"))}&err=${encodeURIComponent(msg)}`);

  const fullName = get("fullName").slice(0, 120), email = get("email").toLowerCase().slice(0, 160), phone = get("phone").replace(/[^\d+]/g, "").slice(0, 20);
  const dob = get("dob") ? new Date(get("dob") + "T00:00:00Z") : null;
  if (!fullName || (!email && !phone)) back("Enter your name and a phone number or email.");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) back("That email address does not look right.");
  if (!dob || Number.isNaN(+dob)) back("Enter your date of birth.");

  // Server-side validation of the selection. Nothing from the browser is trusted.
  const programme = await db.programme.findFirst({ where: { slug: get("course"), status: "PUBLISHED" } });
  if (!programme) back("This course is not open for applications.");
  const offering = (await listOfferings(programme!.id)).find((o) => o.id === get("offering"));
  if (!offering) back("Choose an intake.");
  if (!offering!.accepting) back(offering!.seatsLeft === 0 ? "That intake is full. Choose another." : "That intake is closed. Choose another.");

  const age = (Date.now() - +dob!) / (365.25 * 864e5);
  const minor = age < 18;
  if (minor && (!get("guardianName") || !get("guardianPhone"))) back("Applicants under 18 need a parent or guardian name and phone.");

  const dupe = await db.applicant.findFirst({ where: { programmeId: programme!.id, intakeId: offering!.intakeId, status: { not: "REJECTED" },
    OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] }, select: { id: true } });
  if (dupe) back("An application with these contact details already exists for this intake. Use Track application, or contact admissions.");

  const utm = readUtm((await cookies()).get("tas_utm")?.value);
  const h = await headers();
  let reference = newReference();
  for (let i = 0; i < 5 && (await db.applicant.findUnique({ where: { reference }, select: { id: true } })); i++) reference = newReference();

  const regFee = programme!.registrationFeeRwf;
  const a = await db.$transaction(async (tx) => {
    // Re-check seats inside the transaction to stop two people taking the last seat.
    const used = await tx.applicant.count({ where: { programmeId: programme!.id, intakeId: offering!.intakeId, branchId: offering!.branchId, session: offering!.session, status: { not: "REJECTED" } } });
    if (used >= offering!.seats) return null;
    const created = await tx.applicant.create({ data: {
      fullName, email: email || null, phone: phone || null, dateOfBirth: dob, source: utm?.utmSource ?? "Web", leadSource: utm?.utmSource ?? "Direct website",
      utmSource: utm?.utmSource ?? null, utmMedium: utm?.utmMedium ?? null, utmCampaign: utm?.utmCampaign ?? null,
      language: (h.get("accept-language") ?? "").slice(0, 2) || null, reference, session: offering!.session,
      guardianName: minor ? get("guardianName").slice(0, 120) : null, guardianPhone: minor ? get("guardianPhone").slice(0, 20) : null,
      programmeId: programme!.id, intakeId: offering!.intakeId, branchId: offering!.branchId,
      documents: { create: REQUIRED_DOCS.map((kind) => ({ kind })) },
      events: { create: [{ type: "SYSTEM", actorName: "Website", message: `Application submitted online${utm?.utmSource ? ` (source: ${utm.utmSource})` : ""}.` }] },
    } });
    if (regFee) await tx.invoice.create({ data: { reference: `INV-${reference}`, applicantId: created.id, description: `Registration fee, ${programme!.name}`, amountMinor: regFee, currency: "RWF" } });
    return created;
  });
  if (!a) back("The last seat was just taken. Choose another intake.");

  await db.lead.create({ data: { name: fullName, email: email || null, phone: phone || null, programmeId: programme!.id, source: utm?.utmSource ?? "Website application", utmSource: utm?.utmSource ?? null, utmMedium: utm?.utmMedium ?? null, utmCampaign: utm?.utmCampaign ?? null, message: `Application ${reference}` } });
  await record({ type: "APPLICATION", path: "/apply", programmeId: programme!.id, utmSource: utm?.utmSource, utmMedium: utm?.utmMedium, utmCampaign: utm?.utmCampaign });
  revalidatePath(`/courses/${programme!.slug}`); revalidatePath("/courses");
  redirect(`/apply/done?ref=${reference}`);
}
