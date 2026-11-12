import nodemailer from "nodemailer";
import { db } from "./db";
import { SITE } from "./site";

/** The school's sender and staff inbox. Sending needs the Gmail app password in SMTP_PASS; without it messages are recorded as not sent. */
const FROM_ADDR = process.env.EMAIL_FROM_ADDRESS?.trim() || "timtomaviationschool@gmail.com";
const STAFF_INBOX = process.env.STAFF_ALERT_EMAIL?.trim() || FROM_ADDR;
export const emailConfigured = () => !!process.env.SMTP_PASS;

function transport() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com", port, secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    ...(process.env.SMTP_HOST ? { ignoreTLS: process.env.SMTP_SECURE !== "true" && port !== 465 } : {}),
    auth: { user: process.env.SMTP_USER?.trim() || FROM_ADDR, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000, socketTimeout: 12000,
  });
}

/** Rwandan numbers: 0788..., +250788... and 250788... all become 250788... for wa.me links. */
export function waNumber(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("250")) return d;
  if (d.startsWith("0") && d.length === 10) return "250" + d.slice(1);
  return d;
}
export const waLink = (phone: string | null | undefined, text: string) => { const n = waNumber(phone); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null; };

export async function sendEmail(to: string, subject: string, text: string) {
  await transport().sendMail({ from: `${SITE.name} <${FROM_ADDR}>`, replyTo: FROM_ADDR, to, subject, text });
}

export type Msg = { template: string; subject: string; text: string };
const sign = `\n\n${SITE.name}\n${SITE.phoneDisplay} · ${SITE.address}`;
const trackUrl = (ref: string) => `${SITE.url}/track?ref=${ref}`;
const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-US")}`;

type A = { id: string; fullName: string; email: string | null; phone: string | null; reference: string | null; programme: { name: string }; intake: { label: string }; branch: { name: string }; session: string };
const first = (a: A) => a.fullName.split(" ")[0];

/** Message copy per event. One English text is used for both email and WhatsApp. */
export const COPY = {
  submitted: (a: A): Msg => ({ template: "submitted", subject: `We received your application ${a.reference}`,
    text: `Hello ${first(a)},\n\nThank you for applying to ${a.programme.name}. Your reference is ${a.reference}.\nPlacement requested: ${a.branch.name}, ${a.session === "WEEKDAY" ? "weekday" : "weekend"} schedule, ${a.intake.label} intake.\n\nFollow your application, upload documents and see payment details here:\n${trackUrl(a.reference!)}${sign}` }),
  docMissing: (a: A, kind: string): Msg => ({ template: "doc_missing", subject: `Please send your ${kind} (${a.reference})`,
    text: `Hello ${first(a)},\n\nWe could not accept your "${kind}" for ${a.programme.name}. Please upload a clear copy here:\n${trackUrl(a.reference!)}${sign}` }),
  invoice: (a: A, ref: string, description: string, amount: number): Msg => ({ template: "invoice", subject: `Invoice ${ref}: ${money(amount, "RWF")}`,
    text: `Hello ${first(a)},\n\nInvoice ${ref}: ${description}, ${money(amount, "RWF")}.\nPlease pay using the reference ${ref}. We confirm the payment before your status changes.\n${trackUrl(a.reference!)}${sign}` }),
  paid: (a: A, ref: string): Msg => ({ template: "paid", subject: `Payment received (${ref})`,
    text: `Hello ${first(a)},\n\nWe have confirmed your payment ${ref}. Thank you.\n${trackUrl(a.reference!)}${sign}` }),
  status: (a: A, status: string): Msg => {
    const map: Record<string, [string, string]> = {
      DOCUMENTS_VERIFIED: ["Your documents are verified", "Your documents are verified. Pay any invoice shown on your tracking page using its reference."],
      REGISTRATION_PAID: ["Registration payment confirmed", "Your registration payment is confirmed. Admissions will now make a decision."],
      ADMITTED: ["You have been admitted", `Congratulations, you have been admitted to ${a.programme.name}. Admissions will confirm your class group.`],
      ENROLLED: ["You are enrolled", `You are now enrolled in ${a.programme.name}, starting ${a.intake.label}. Welcome to ${SITE.name}.`],
      REJECTED: ["Update on your application", `Your application for ${a.programme.name} was not admitted. Please contact admissions for guidance.`],
    };
    const [subject, line] = map[status] ?? ["Update on your application", "Your application status has changed."];
    return { template: `status_${status.toLowerCase()}`, subject: `${subject} (${a.reference})`, text: `Hello ${first(a)},\n\n${line}\n${trackUrl(a.reference!)}${sign}` };
  },
  placement: (a: A): Msg => ({ template: "placement", subject: `Your placement was updated (${a.reference})`,
    text: `Hello ${first(a)},\n\nYour placement for ${a.programme.name} is now ${a.branch.name}, ${a.session === "WEEKDAY" ? "weekday" : "weekend"} schedule, ${a.intake.label} intake.\n${trackUrl(a.reference!)}${sign}` }),
};

/**
 * Records one email (if the applicant gave an address) and one WhatsApp message (if they gave a phone number).
 * Email is sent now when configured. WhatsApp is queued for staff to send from the school's number in one click.
 * Never throws: a failed message must not fail the admissions action that caused it.
 */
export async function notifyApplicant(applicantId: string, build: (a: A) => Msg) {
  try {
    const a = await db.applicant.findUnique({ where: { id: applicantId }, include: { programme: { select: { name: true } }, intake: { select: { label: true } }, branch: { select: { name: true } } } });
    if (!a || !a.reference) return;
    const m = build(a as A);
    if (a.email) {
      const row = await db.notification.create({ data: { applicantId, channel: "EMAIL", template: m.template, to: a.email, subject: m.subject, body: m.text, status: emailConfigured() ? "QUEUED" : "SKIPPED", error: emailConfigured() ? null : "Email is not configured (SMTP_PASS missing)." } });
      if (emailConfigured()) {
        try { await sendEmail(a.email, m.subject, m.text); await db.notification.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date() } }); }
        catch (e) { await db.notification.update({ where: { id: row.id }, data: { status: "FAILED", error: (e instanceof Error ? e.message : "Send failed").slice(0, 300) } }); }
      }
    }
    if (a.phone) await db.notification.create({ data: { applicantId, channel: "WHATSAPP", template: m.template, to: a.phone, body: m.text, status: "QUEUED" } });
  } catch { /* notifications are best effort */ }
}

/** Plain alert to the school's inbox, for new applications and enquiries. */
export async function alertStaff(subject: string, text: string) {
  if (!emailConfigured()) return;
  try { await sendEmail(STAFF_INBOX, subject, text); } catch { /* best effort */ }
}
