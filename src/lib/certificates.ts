import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { db } from "./db";
import { resultsFor, type Actor } from "./assessment";
import { notifyApplicant, type Msg } from "./notify";
import { safe, day } from "./docs";
import { SITE } from "./site";

const officer = (a: Actor) => a.role === "ADMIN" || a.role === "ACADEMIC";
export const certKind = (programmeType: string) => (programmeType === "ADVANCED_CERTIFICATE" ? "Advanced Certificate" : programmeType === "DIPLOMA" ? "Diploma" : "Certificate");
/** TAS-YYYY-NNNNNN, unique. The sequence continues from the highest number of the year. */
export async function nextCertNumber(year = new Date().getUTCFullYear()) {
  const last = await db.certificate.findFirst({ where: { number: { startsWith: `TAS-${year}-` } }, orderBy: { number: "desc" }, select: { number: true } });
  return `TAS-${year}-${String((last ? Number(last.number.split("-")[2]) || 0 : 0) + 1).padStart(6, "0")}`;
}
/** CRT-01: a School certificate is issued only to an enrolled student whose results are complete, published and at or above the pass mark, once. */
export async function issueCertificate(a: Actor, applicantId: string): Promise<string | { number: string }> {
  if (!officer(a)) return "Only academic staff can issue certificates."; const s = await db.applicant.findUnique({ where: { id: applicantId }, include: { programme: true } }); if (!s) return "Student not found."; if (s.status !== "ENROLLED") return "Only enrolled students can receive a certificate.";
  if (await db.certificate.findFirst({ where: { holderId: applicantId, programmeId: s.programmeId, status: "VALID" } })) return "This student already holds a valid certificate for this programme. Revoke it first to reissue.";
  const r = await resultsFor(applicantId); if (!r || !r.result.complete) return "Results are not complete: every part of the grading scheme needs a published mark."; if (!r.result.passed) return `The final mark (${r.result.overall}%) is below the pass mark (${r.scheme.passMark}%).`;
  for (let i = 0; i < 5; i++) { const number = await nextCertNumber(); try { await db.certificate.create({ data: { number, holderId: applicantId, programmeId: s.programmeId, kind: certKind(s.programme.type), finalMark: r.result.overall, issuedBy: a.name, issuedOn: new Date() } });
      await db.applicationEvent.create({ data: { applicantId, type: "SYSTEM", actorName: a.name, message: `Certificate ${number} issued (final mark ${r.result.overall}%).` } });
      await notifyApplicant(applicantId, (x): Msg => ({ template: "certificate_issued", subject: `Your certificate ${number}`, text: `Hello ${x.fullName.split(" ")[0]},\n\nCongratulations. Your ${certKind(s.programme.type).toLowerCase()} for ${s.programme.name} has been issued, number ${number}. Download it from your dashboard.\n${SITE.url}/me\n\n${SITE.name}` })); return { number }; } catch (e) { if (i === 4) throw e; } }
  return "Could not allocate a certificate number. Try again.";
}
/** CRT-03: revocation needs a reason and is recorded with who and when. The certificate then fails public verification. */
export async function revokeCertificate(a: Actor, number: string, reasonRaw: string): Promise<string | null> {
  if (!officer(a)) return "Only academic staff can revoke certificates."; const reason = (reasonRaw ?? "").trim().slice(0, 400); if (reason.length < 5) return "Give the reason for revoking."; const c = await db.certificate.findUnique({ where: { number } }); if (!c) return "Certificate not found."; if (c.status === "REVOKED") return "Already revoked.";
  await db.certificate.update({ where: { number }, data: { status: "REVOKED", revokedAt: new Date(), revokedBy: a.name, revokeReason: reason } }); await db.applicationEvent.create({ data: { applicantId: c.holderId, type: "SYSTEM", actorName: a.name, message: `Certificate ${number} revoked. Reason: ${reason}` } }); return null;
}
/** CRT-03: reissue replaces a revoked certificate with a new number that points back to the old one. */
export async function reissueCertificate(a: Actor, number: string): Promise<string | { number: string }> {
  if (!officer(a)) return "Only academic staff can reissue certificates."; const c = await db.certificate.findUnique({ where: { number } }); if (!c) return "Certificate not found."; if (c.status !== "REVOKED") return "Revoke the certificate before reissuing it.";
  if (await db.certificate.findFirst({ where: { replacesNumber: number } })) return "This certificate was already reissued."; const n = await nextCertNumber();
  await db.certificate.create({ data: { number: n, holderId: c.holderId, programmeId: c.programmeId, kind: c.kind, finalMark: c.finalMark, issuer: c.issuer, issuedBy: a.name, issuedOn: new Date(), replacesNumber: number } }); await db.applicationEvent.create({ data: { applicantId: c.holderId, type: "SYSTEM", actorName: a.name, message: `Certificate ${n} issued to replace ${number}.` } }); return { number: n };
}

export const certVerifyUrl = (number: string) => `${SITE.url}/verify?n=${encodeURIComponent(number)}`;
/** Landscape certificate with the unique number and a QR code that opens public verification. */
export async function buildCertificate(c: { number: string; kind: string; holder: string; programme: string; issuedOn: Date; finalMark?: number | null; replacesNumber?: string | null }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create(); pdf.setTitle(`${c.kind} ${c.number}`); pdf.setAuthor(SITE.name); const p = pdf.addPage([842, 595]); const R = await pdf.embedFont(StandardFonts.TimesRoman), B = await pdf.embedFont(StandardFonts.TimesRomanBold), I = await pdf.embedFont(StandardFonts.TimesRomanItalic), H = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.04, 0.13, 0.25), blue = rgb(0.04, 0.3, 0.64), gold = rgb(0.72, 0.56, 0.2), grey = rgb(0.36, 0.42, 0.51); const mid = (t: string, y: number, f: typeof R, size: number, color = navy) => p.drawText(safe(t), { x: (842 - f.widthOfTextAtSize(safe(t), size)) / 2, y, size, font: f, color });
  p.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: gold, borderWidth: 3 }); p.drawRectangle({ x: 34, y: 34, width: 774, height: 527, borderColor: navy, borderWidth: 1 });
  mid(SITE.name.toUpperCase(), 500, H, 22, navy); mid(SITE.address, 480, R, 11, grey); mid(c.kind.toUpperCase(), 425, B, 34, blue); mid("This is to certify that", 380, I, 15, grey);
  let size = 34; while (size > 18 && B.widthOfTextAtSize(safe(c.holder), size) > 680) size -= 2; mid(c.holder, 335, B, size, navy); p.drawLine({ start: { x: 221, y: 322 }, end: { x: 621, y: 322 }, thickness: 1, color: gold });
  mid("has successfully completed the programme", 292, I, 15, grey); let ps = 22; while (ps > 13 && B.widthOfTextAtSize(safe(c.programme), ps) > 700) ps -= 1; mid(c.programme, 258, B, ps, navy);
  mid(`Awarded on ${day(c.issuedOn)}${c.finalMark != null ? `  ·  Final mark ${c.finalMark}%` : ""}`, 222, R, 13, navy);
  const qr = await pdf.embedPng(await QRCode.toBuffer(certVerifyUrl(c.number), { margin: 1, width: 300 })); p.drawImage(qr, { x: 690, y: 60, width: 96, height: 96 });
  p.drawText(`Certificate No. ${c.number}`, { x: 60, y: 120, size: 13, font: H, color: navy }); p.drawText(safe(`Verify at ${SITE.url}/verify or scan the code.`), { x: 60, y: 102, size: 10, font: R, color: grey }); if (c.replacesNumber) p.drawText(`Replaces certificate ${c.replacesNumber}.`, { x: 60, y: 86, size: 10, font: I, color: grey });
  p.drawLine({ start: { x: 330, y: 120 }, end: { x: 530, y: 120 }, thickness: 0.8, color: navy }); mid("Head of Academics", 104, R, 11, grey); p.drawText("Issued electronically. Valid only when the number verifies as VALID.", { x: 60, y: 60, size: 8, font: I, color: grey });
  return pdf.save();
}

/* ---------- ASM-04, CRT-04, STU-08: IATA / ICAO exams ---------- */
export const EXAM_BODIES = ["IATA", "ICAO"] as const; export const EXAM_STATUSES = ["REQUESTED", "REGISTERED", "SAT", "PASSED", "FAILED", "CANCELLED"] as const;
export async function requestExam(applicantId: string, body: string, nameRaw: string): Promise<string | null> {
  const s = await db.applicant.findUnique({ where: { id: applicantId } }); if (!s || s.status !== "ENROLLED") return "This is available once you are enrolled."; if (!EXAM_BODIES.includes(body as "IATA")) return "Choose IATA or ICAO."; const examName = (nameRaw ?? "").trim().slice(0, 140); if (examName.length < 3) return "Enter the name of the exam.";
  if (await db.externalExam.count({ where: { applicantId, status: { in: ["REQUESTED", "REGISTERED"] } } }) >= 3) return "You already have 3 exam registrations in progress."; await db.externalExam.create({ data: { applicantId, body, examName } }); return null;
}
export type ExamUpdate = { status?: string; feeAmount?: string; feeCurrency?: string; feePaidToBodyOn?: string; examDate?: string; result?: string; certificateNo?: string; certificateReceivedOn?: string };
/** Staff keep the record: registration, the fee paid on to IATA/ICAO, the date, the result and the certificate received from the body. */
export async function updateExam(a: Actor, id: string, d: ExamUpdate): Promise<string | null> {
  if (!["ADMIN", "ACADEMIC", "ADMISSIONS"].includes(a.role)) return "Not allowed."; const x = await db.externalExam.findUnique({ where: { id } }); if (!x) return "Exam record not found."; const status = d.status ?? x.status; if (!EXAM_STATUSES.includes(status as "SAT")) return "Unknown status.";
  const date = (v?: string) => (v ? (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00Z") : undefined) : null); const paid = date(d.feePaidToBodyOn), exam = date(d.examDate), rec = date(d.certificateReceivedOn); if (paid === undefined || exam === undefined || rec === undefined) return "Check the dates.";
  const fee = d.feeAmount ? Number(d.feeAmount) : null; if (fee !== null && !(fee >= 0 && fee < 1e7)) return "Check the fee."; const certNo = (d.certificateNo ?? "").trim().slice(0, 80) || null;
  if ((certNo || rec) && status !== "PASSED") return "A certificate can only be recorded for a passed exam."; if (["SAT", "PASSED", "FAILED"].includes(status) && !exam) return "Enter the exam date.";
  await db.externalExam.update({ where: { id }, data: { status, feeAmount: fee === null ? null : Math.round(fee), feeCurrency: ["USD", "RWF"].includes(d.feeCurrency ?? "") ? d.feeCurrency! : x.feeCurrency, feePaidToBodyOn: paid, examDate: exam, result: (d.result ?? "").trim().slice(0, 80) || null, certificateNo: certNo, certificateReceivedOn: rec, updatedBy: a.name, updatedAt: new Date() } });
  if (status !== x.status) { await db.applicationEvent.create({ data: { applicantId: x.applicantId, type: "SYSTEM", actorName: a.name, message: `${x.body} exam "${x.examName}": ${status.toLowerCase()}.` } });
    await notifyApplicant(x.applicantId, (s): Msg => ({ template: "exam_update", subject: `${x.body} exam update: ${x.examName}`, text: `Hello ${s.fullName.split(" ")[0]},\n\nYour ${x.body} exam "${x.examName}" is now: ${status.toLowerCase()}.${exam ? ` Date: ${exam.toISOString().slice(0, 10)}.` : ""}\n${SITE.url}/me\n\n${SITE.name}` })); }
  return null;
}
