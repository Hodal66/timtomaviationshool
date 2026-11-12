import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getApplicantEmail } from "@/lib/otp";
import { getT } from "@/lib/i18n/server";
import { label, money, STAGES } from "@/lib/format";
import { MeDashboard, type MeApp } from "@/components/MeDashboard";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My dashboard | Timtom Aviation School", robots: { index: false } };

export default async function Me() {
  const email = (await getApplicantEmail())!; const { t } = await getT();
  const rows = await db.applicant.findMany({ where: { email }, orderBy: { createdAt: "desc" }, include: { programme: { select: { name: true, slug: true } }, branch: { select: { name: true } }, intake: { select: { label: true } }, documents: true, invoices: true, events: { orderBy: { createdAt: "desc" }, take: 40 } } });
  const ups = await db.upload.findMany({ where: { applicant: { email } }, select: { id: true, kind: true, filename: true, size: true, applicantId: true } });
  const NEXT: Record<string, string> = {
    SUBMITTED: t("We are checking your documents. Upload any that are missing."), DOCUMENTS_VERIFIED: t("Your documents are verified. Pay the registration fee and send the transaction reference to Finance."),
    REGISTRATION_PAID: t("Payment confirmed. Admissions will give you the final decision soon."), ADMITTED: t("You are admitted. We will place you in a class and confirm your start date."), ENROLLED: t("You are enrolled. Welcome to Timtom Aviation School!"), REJECTED: t("This application was not admitted. Contact admissions to discuss your options."),
  };
  const apps: MeApp[] = rows.map((a) => ({
    id: a.id, reference: a.reference ?? "", programme: a.programme.name, slug: a.programme.slug ?? "", branch: a.branch.name, intake: a.intake.label, session: a.session === "WEEKDAY" ? t("Weekday") : t("Weekend"), status: a.status, statusLabel: t(label(a.status)), next: NEXT[a.status] ?? "", at: a.createdAt.toISOString().slice(0, 10),
    name: a.fullName, phone: a.phone ?? "", dob: a.dateOfBirth?.toISOString().slice(0, 10) ?? "", verified: !!a.emailVerifiedAt,
    docs: a.documents.map((d) => ({ id: d.id, kind: d.kind, status: d.status, note: d.note ?? "", file: ups.find((u) => u.applicantId === a.id && u.kind === d.kind) ?? null })),
    invoices: a.invoices.map((i) => ({ id: i.id, reference: i.reference, description: i.description, amount: money(i.amountMinor, i.currency), value: i.amountMinor, status: i.status, paid: i.paidAt?.toISOString().slice(0, 10) ?? "" })),
    events: a.events.map((e) => ({ at: e.createdAt.toISOString().slice(0, 16).replace("T", " "), message: e.message, actor: e.actorName })),
  }));
  return <MeDashboard email={email} apps={apps} stages={STAGES.map((s) => ({ key: s, label: t(label(s)) }))} />;
}
