import { db } from "./db";
import { STAGES } from "./format";
import { COPY, notifyApplicant } from "./notify";

/** Moves an applicant one stage forward when the SRS rules for that step are met. Returns an error message or null. */
export async function advanceApplicant(id: string, actor: string): Promise<string | null> {
  const a = await db.applicant.findUnique({ where: { id }, include: { documents: true, invoices: true, programme: { select: { entryRequirements: true } } } });
  if (!a) return "Applicant not found.";
  const i = STAGES.indexOf(a.status as (typeof STAGES)[number]);
  if (i < 0) return "This application is closed.";
  if (i >= STAGES.length - 1) return "Already enrolled.";
  const next = STAGES[i + 1];
  if (next === "DOCUMENTS_VERIFIED" && a.documents.some((d) => d.status !== "VERIFIED")) return "Verify every required document first.";
  if (next === "REGISTRATION_PAID" && a.invoices.some((v) => v.status !== "PAID" && v.status !== "CANCELLED")) return "The registration invoice is not paid. Finance must verify the payment.";
  if (next === "ADMITTED") { const missing = a.programme.entryRequirements.filter((r) => !a.requirementsMet.includes(r)); if (missing.length) return `Confirm the entry requirements first (${missing.length} not yet confirmed).`; }
  const group = next === "ENROLLED" ? await db.classGroup.findFirst({ where: { programmeId: a.programmeId, branchId: a.branchId, intakeId: a.intakeId, session: a.session } }) : null;
  await db.applicant.update({ where: { id }, data: { status: next, ...(next === "ADMITTED" ? { admittedAt: new Date() } : {}), ...(group ? { classGroupId: group.id } : {}),
    events: { create: { type: "STATUS", actorName: actor, message: `Status changed to ${next.replace(/_/g, " ").toLowerCase()}.${group ? ` Placed in ${group.name}.` : ""}` } } } });
  await notifyApplicant(id, (a) => COPY.status(a, next));
  if (next === "ADMITTED") { const { setTuitionPlan } = await import("./finance"); await setTuitionPlan(id, 1, "System"); } // FIN-01: tuition is invoiced on admission
  return null;
}
