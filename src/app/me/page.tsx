import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getApplicantEmail } from "@/lib/otp";
import { getT } from "@/lib/i18n/server";
import { label, money, STAGES } from "@/lib/format";
import { balanceOf, outstandingOn } from "@/lib/finance";
import { calToken, rateOf } from "@/lib/teaching";
import { DAYS, hhmm } from "@/lib/format";
import { SITE } from "@/lib/site";
import { DOC_KINDS } from "@/lib/apply";
import QRCode from "qrcode";
import { idToken } from "@/lib/student";
import { LETTER_TYPES } from "@/lib/docs";
import { kigaliDow } from "@/lib/teaching";
import { MeDashboard, type MeApp } from "@/components/MeDashboard";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My dashboard | Timtom Aviation School", robots: { index: false } };

export default async function Me() {
  const email = (await getApplicantEmail())!; const { t } = await getT();
  const rows = await db.applicant.findMany({ where: { email }, orderBy: { createdAt: "desc" }, include: { programme: { select: { name: true, slug: true } }, branch: { select: { name: true } }, intake: { select: { label: true } }, documents: true, invoices: { include: { payments: true }, orderBy: { createdAt: "asc" } }, events: { orderBy: { createdAt: "desc" }, take: 40 } } });
  const gids = rows.map((r) => r.classGroupId).filter(Boolean) as string[];
  const [gslots, att] = await Promise.all([db.timetableSlot.findMany({ where: { groupId: { in: gids } }, include: { room: true, lecturer: true, group: true }, orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }] }), db.attendance.findMany({ where: { applicantId: { in: rows.map((r) => r.id) } }, select: { applicantId: true, status: true } })]);
  const ups = await db.upload.findMany({ where: { applicant: { email } }, select: { id: true, kind: true, filename: true, size: true, applicantId: true } });
  const ids = rows.map((r) => r.id); const dow = kigaliDow();
  const [reqs, tix, notes, branches] = await Promise.all([db.studentRequest.findMany({ where: { applicantId: { in: ids } }, orderBy: { createdAt: "desc" } }), db.ticket.findMany({ where: { applicantId: { in: ids } }, include: { messages: { orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" } }),
    db.announcement.findMany({ where: { OR: [{ groupId: null }, { groupId: { in: gids } }] }, orderBy: { createdAt: "desc" }, take: 6 }), db.branch.findMany({ orderBy: { code: "asc" }, select: { id: true, name: true } })]);
  const portal = Object.fromEntries(await Promise.all(rows.map(async (a) => { const tok = idToken(a.id); const url = `${SITE.url}/id/${tok}`; const enrolled = a.status === "ENROLLED"; const next = a.invoices.filter((i) => i.status === "PENDING" && outstandingOn(i) > 0).sort((x, y) => +(x.dueOn ?? x.createdAt) - +(y.dueOn ?? y.createdAt))[0];
    return [a.id, { enrolled, emergencyName: a.emergencyName ?? "", emergencyPhone: a.emergencyPhone ?? "", branchId: a.branchId, sessionCode: a.session, idUrl: url, idQr: enrolled ? await QRCode.toString(url, { type: "svg", margin: 1, width: 180 }) : "", photo: ups.some((u) => u.applicantId === a.id && u.kind === "Profile photo") ? `/api/id/${tok}/photo` : "",
      today: gslots.filter((s) => s.groupId === a.classGroupId && s.dayOfWeek === dow).map((s) => ({ time: `${hhmm(s.startMin)}–${hhmm(s.endMin)}`, subject: s.subject, room: s.room.name })), nextDue: next ? { ref: next.reference, amount: money(outstandingOn(next), "RWF"), due: next.dueOn?.toISOString().slice(0, 10) ?? "" } : null,
      docs: [...(["ADMITTED", "ENROLLED"].includes(a.status) ? [{ label: t("Admission letter"), href: `/api/me/doc?a=${a.id}&kind=admission` }] : []), ...(enrolled ? [{ label: t("Confirmation of enrolment"), href: `/api/me/doc?a=${a.id}&kind=enrolment` }] : []), ...(a.invoices.length ? [{ label: t("Statement of account"), href: `/api/me/doc?a=${a.id}&kind=statement` }] : []),
        ...reqs.filter((r) => r.applicantId === a.id && r.type === "LETTER" && r.status === "APPROVED").map((r) => ({ label: t(LETTER_TYPES[(r.detail as { letter: keyof typeof LETTER_TYPES }).letter] ?? "Letter"), href: `/api/me/doc?a=${a.id}&kind=letter&id=${r.id}` }))], zip: `/api/me/zip?a=${a.id}`,
      requests: reqs.filter((r) => r.applicantId === a.id).map((r) => ({ id: r.id, type: r.type, what: r.type === "LETTER" ? t(LETTER_TYPES[(r.detail as { letter: keyof typeof LETTER_TYPES }).letter] ?? "Letter") : t(label(r.type)), status: r.status, note: r.note ?? "", at: r.createdAt.toISOString().slice(0, 10) })) }]; })));
  const NEXT: Record<string, string> = {
    SUBMITTED: t("We are checking your documents. Upload any that are missing."), DOCUMENTS_VERIFIED: t("Your documents are verified. Pay the registration fee and send the transaction reference to Finance."),
    REGISTRATION_PAID: t("Payment confirmed. Admissions will give you the final decision soon."), ADMITTED: t("You are admitted. We will place you in a class and confirm your start date."), ENROLLED: t("You are enrolled. Welcome to Timtom Aviation School!"), REJECTED: t("This application was not admitted. Contact admissions to discuss your options."),
  };
  const apps: MeApp[] = rows.map((a) => ({
    id: a.id, reference: a.reference ?? "", programme: a.programme.name, slug: a.programme.slug ?? "", branch: a.branch.name, intake: a.intake.label, session: a.session === "WEEKDAY" ? t("Weekday") : t("Weekend"), status: a.status, statusLabel: t(label(a.status)), next: NEXT[a.status] ?? "", at: a.createdAt.toISOString().slice(0, 10),
    name: a.fullName, phone: a.phone ?? "", dob: a.dateOfBirth?.toISOString().slice(0, 10) ?? "", verified: !!a.emailVerifiedAt,
    docs: [...a.documents].sort((x, y) => DOC_KINDS.indexOf(x.kind as never) - DOC_KINDS.indexOf(y.kind as never) || x.kind.localeCompare(y.kind)).map((d) => ({ id: d.id, kind: d.kind, status: d.status, note: d.note ?? "", file: ups.find((u) => u.applicantId === a.id && u.kind === d.kind) ?? null })),
    invoices: a.invoices.filter((i) => i.status !== "CANCELLED").map((i) => ({ id: i.id, reference: i.reference, description: i.description, amount: money(i.amountMinor, i.currency), value: i.amountMinor, status: i.status, paid: i.paidAt?.toISOString().slice(0, 10) ?? "", due: i.dueOn?.toISOString().slice(0, 10) ?? "", overdue: !!i.dueOn && i.dueOn < new Date() && i.status === "PENDING", left: outstandingOn(i), leftText: money(outstandingOn(i), "RWF"), kind: i.kind, reported: i.payments.filter((p) => p.status === "UNMATCHED").length })),
    group: gslots.find((s) => s.groupId === a.classGroupId)?.group.name ?? "", calendar: a.classGroupId ? `${SITE.url}/api/calendar/${calToken("g", a.classGroupId)}.ics` : "", attendance: rateOf(att.filter((x) => x.applicantId === a.id).map((x) => x.status)), sessions: att.filter((x) => x.applicantId === a.id).length,
    classes: gslots.filter((s) => s.groupId === a.classGroupId).map((s) => ({ id: s.id, day: t(DAYS[s.dayOfWeek]), dow: s.dayOfWeek, time: `${hhmm(s.startMin)}–${hhmm(s.endMin)}`, subject: s.subject, room: s.room.name, lecturer: s.lecturer.name })),
    money: (() => { const b = balanceOf(a.invoices); return { billed: money(b.billed, "RWF"), paid: money(b.paid, "RWF"), balance: money(b.balance, "RWF"), due: b.balance }; })(),
    canPlan: ["ADMITTED", "ENROLLED"].includes(a.status) && a.invoices.some((i) => i.kind === "TUITION") && !a.invoices.some((i) => i.kind === "TUITION" && i.payments.length > 0), plan: a.invoices.filter((i) => i.kind === "TUITION").length,
    events: a.events.map((e) => ({ at: e.createdAt.toISOString().slice(0, 16).replace("T", " "), message: e.message, actor: e.actorName })),
  }));
  const services = { portal, branches, letterTypes: Object.entries(LETTER_TYPES).map(([k, v]) => ({ k, label: t(v) })), announcements: notes.map((n) => ({ id: n.id, title: n.title, body: n.body, at: n.createdAt.toISOString().slice(0, 10) })),
    tickets: tix.map((k) => ({ id: k.id, applicantId: k.applicantId, subject: k.subject, category: k.category, status: k.status, rating: k.rating, messages: k.messages.map((m) => ({ id: m.id, staff: m.fromStaff, author: m.fromStaff ? m.author : t("You"), body: m.body, at: m.createdAt.toISOString().slice(0, 16).replace("T", " ") })) })) };
  return <MeDashboard email={email} apps={apps} stages={STAGES.map((s) => ({ key: s, label: t(label(s)) }))} services={services} />;
}
