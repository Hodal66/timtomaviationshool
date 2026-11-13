import { createHmac, timingSafeEqual } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { SITE } from "./site";
import { money } from "./format";

/** Short code printed on the letter and carried in its QR link, so a letter cannot be checked by guessing references. */
export const letterCode = (reference: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "").update("letter|" + reference).digest("hex").slice(0, 12).toUpperCase();
export const letterCodeOk = (reference: string, code: string) => { const a = Buffer.from(letterCode(reference)), b = Buffer.from((code ?? "").toUpperCase()); return a.length === b.length && timingSafeEqual(a, b); };
export const letterUrl = (reference: string) => `${SITE.url}/verify?letter=${encodeURIComponent(reference)}&k=${letterCode(reference)}`;
export const LETTER_STAGES = ["ADMITTED", "ENROLLED"];

export type LetterData = { reference: string; fullName: string; programme: string; qualification?: string | null; branch: string; intake: string; startsOn?: Date | null; session: string; admittedAt: Date; feeRwf?: number | null; requirements: string[] };
const NAVY = rgb(0.04, 0.13, 0.25), BLUE = rgb(0.04, 0.3, 0.64), ORANGE = rgb(0.97, 0.54, 0.23), GREY = rgb(0.36, 0.42, 0.51);
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kigali" });
/** WinAnsi fonts cannot draw every character; anything outside Latin-1 is replaced so a name never breaks the letter. */
const safe = (s: string) => s.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
function para(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number, color = NAVY, gap = 1.45) {
  let line = ""; for (const w of safe(text).split(/\s+/)) { const t = line ? line + " " + w : w; if (font.widthOfTextAtSize(t, size) > width && line) { page.drawText(line, { x, y, size, font, color }); y -= size * gap; line = w; } else line = t; }
  if (line) { page.drawText(line, { x, y, size, font, color }); y -= size * gap; } return y;
}

/** ADM-07: admission letter with a QR code that opens the School's verification page, plus a welcome pack page. */
export async function buildAdmissionLetter(d: LetterData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create(); pdf.setTitle(`Admission letter ${d.reference}`); pdf.setAuthor(SITE.name); pdf.setSubject("Admission letter"); pdf.setCreationDate(d.admittedAt);
  const R = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold), I = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const qr = await pdf.embedPng(await QRCode.toBuffer(letterUrl(d.reference), { margin: 1, width: 300, errorCorrectionLevel: "M" }));
  const head = (p: PDFPage, title: string) => { p.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: NAVY }); p.drawRectangle({ x: 0, y: 778, width: 595, height: 4, color: ORANGE }); p.drawText(safe(SITE.name), { x: 48, y: 806, size: 18, font: B, color: rgb(1, 1, 1) }); p.drawText(title, { x: 48, y: 790, size: 10, font: R, color: rgb(0.8, 0.86, 0.94) });
    p.drawText(safe(`${SITE.address}  |  ${SITE.phoneDisplay}  |  ${SITE.email}`), { x: 48, y: 30, size: 8, font: R, color: GREY }); p.drawText(`Reference ${d.reference}`, { x: 440, y: 30, size: 8, font: R, color: GREY }); };
  const p1 = pdf.addPage([595, 842]); head(p1, "Office of Admissions"); let y = 740;
  p1.drawText(day(d.admittedAt), { x: 48, y, size: 10, font: R, color: GREY }); p1.drawText(`Ref: ${d.reference}`, { x: 420, y, size: 10, font: B, color: NAVY }); y -= 34;
  p1.drawText("LETTER OF ADMISSION", { x: 48, y, size: 16, font: B, color: BLUE }); y -= 30;
  p1.drawText(safe(`Dear ${d.fullName},`), { x: 48, y, size: 11, font: R, color: NAVY }); y -= 22;
  y = para(p1, `We are pleased to inform you that you have been admitted to ${SITE.name} for the programme below. Congratulations on this achievement.`, 48, y, 499, R, 11) - 10;
  const rows: [string, string][] = [["Programme", d.programme], ...(d.qualification ? [["Qualification", d.qualification] as [string, string]] : []), ["Branch", d.branch], ["Intake", d.intake + (d.startsOn ? ` (classes start ${day(d.startsOn)})` : "")], ["Schedule", d.session], ...(d.feeRwf ? [["Tuition", money(d.feeRwf, "RWF")] as [string, string]] : [])];
  p1.drawRectangle({ x: 48, y: y - rows.length * 20 - 6, width: 499, height: rows.length * 20 + 14, color: rgb(0.95, 0.97, 0.99), borderColor: rgb(0.87, 0.9, 0.94), borderWidth: 1 }); y -= 10;
  for (const [k, v] of rows) { p1.drawText(k, { x: 60, y, size: 10, font: B, color: GREY }); para(p1, v, 170, y, 365, R, 10); y -= 20; } y -= 14;
  y = para(p1, "This admission is offered on the basis of the documents you submitted, which have been verified, and of your registration payment. It remains valid for the intake named above. If you cannot start in that intake, contact Admissions before the start date so that your place can be moved.", 48, y, 499, R, 11) - 6;
  if (d.requirements.length) { p1.drawText("Entry requirements confirmed by Admissions:", { x: 48, y, size: 10, font: B, color: NAVY }); y -= 16; for (const r of d.requirements.slice(0, 8)) y = para(p1, "-  " + r, 56, y, 480, R, 10, NAVY, 1.4); y -= 6; }
  y = para(p1, "Your first-day instructions and welcome pack are on the next page. We look forward to welcoming you.", 48, y, 499, R, 11) - 22;
  p1.drawText("Admissions Office", { x: 48, y, size: 11, font: B, color: NAVY }); y -= 14; p1.drawText(safe(SITE.name), { x: 48, y, size: 10, font: R, color: GREY }); y -= 14; p1.drawText("Issued electronically. Valid without a handwritten signature when verified with the code below.", { x: 48, y, size: 8, font: I, color: GREY });
  p1.drawImage(qr, { x: 437, y: 70, width: 110, height: 110 }); p1.drawText("Scan to verify this letter", { x: 48, y: 150, size: 10, font: B, color: NAVY }); p1.drawText(`Verification code: ${letterCode(d.reference)}`, { x: 48, y: 134, size: 10, font: R, color: NAVY });
  para(p1, `Or open ${SITE.url}/verify and enter reference ${d.reference} with the code. The School confirms the name, programme and current status.`, 48, 118, 360, R, 9, GREY);
  const p2 = pdf.addPage([595, 842]); head(p2, "Welcome pack and first-day instructions"); y = 740;
  p2.drawText(safe(`Welcome, ${d.fullName.split(" ")[0]}`), { x: 48, y, size: 16, font: B, color: BLUE }); y -= 28;
  const sec = (t: string, items: string[]) => { p2.drawText(t, { x: 48, y, size: 12, font: B, color: NAVY }); y -= 18; for (const it of items) y = para(p2, "-  " + it, 56, y, 485, R, 10.5, NAVY, 1.45) - 2; y -= 10; };
  sec("Your first day", [`Come to the ${d.branch} branch on the first day of the ${d.intake} intake${d.startsOn ? `, ${day(d.startsOn)}` : ""}. Arrive 30 minutes early for registration.`, `Your schedule: ${d.session}.`, "Bring this letter (printed or on your phone) and the original of each document you uploaded: national ID or passport, academic certificate or transcripts."]);
  sec("Before you start", ["Check your dashboard for any invoice that is still open and pay it by mobile money or bank. Send the transaction reference to Finance so that it can be confirmed.", "Keep your phone number and email up to date: class notices and changes are sent by email and WhatsApp.", "If you are under 18, come with your parent or guardian on the first day."]);
  sec("During your studies", ["Attendance is recorded for every session. Tell your lecturer or the branch office in advance if you cannot attend.", "Follow your application and student record at any time from your dashboard: " + SITE.url + "/me"]);
  sec("Need help?", [`Call or WhatsApp ${SITE.phoneDisplay}, or email ${SITE.email}.`, `Address: ${SITE.address}.`]);
  return pdf.save();
}
