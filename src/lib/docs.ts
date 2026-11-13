import { createHmac, timingSafeEqual } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { SITE } from "./site";

/** Official documents a student can download. Each carries a code and QR link so a third party can check it with the School. */
export const docCode = (docId: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "").update("doc|" + docId).digest("hex").slice(0, 12).toUpperCase();
export const docCodeOk = (docId: string, code: string) => { const a = Buffer.from(docCode(docId)), b = Buffer.from((code ?? "").toUpperCase()); return a.length === b.length && timingSafeEqual(a, b); };
export const docUrl = (docId: string) => `${SITE.url}/verify?doc=${encodeURIComponent(docId)}&k=${docCode(docId)}`;
export const LETTER_TYPES = { RECOMMENDATION: "Recommendation letter", VISA: "Visa support letter", INTERNSHIP: "Internship introduction letter", OTHER: "Other official letter" } as const;
export type LetterType = keyof typeof LETTER_TYPES;

const NAVY = rgb(0.04, 0.13, 0.25), BLUE = rgb(0.04, 0.3, 0.64), ORANGE = rgb(0.97, 0.54, 0.23), GREY = rgb(0.36, 0.42, 0.51);
export const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kigali" });
export const safe = (s: string) => s.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
function para(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number, color = NAVY) {
  let line = ""; for (const w of safe(text).split(/\s+/)) { const t = line ? line + " " + w : w; if (font.widthOfTextAtSize(t, size) > width && line) { page.drawText(line, { x, y, size, font, color }); y -= size * 1.45; line = w; } else line = t; }
  if (line) { page.drawText(line, { x, y, size, font, color }); y -= size * 1.45; } return y;
}
export type DocInput = { docId: string; title: string; office?: string; date: Date; salutation?: string; paragraphs: string[]; table?: { head: string[]; rows: string[][]; widths: number[] }; footer?: string; signatory?: string };
/** One-page School document with letterhead, optional table, verification code and QR. */
export async function buildDoc(d: DocInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create(); pdf.setTitle(`${d.title} ${d.docId}`); pdf.setAuthor(SITE.name); pdf.setCreationDate(d.date);
  const R = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold), I = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const qr = await pdf.embedPng(await QRCode.toBuffer(docUrl(d.docId), { margin: 1, width: 300 }));
  let p = pdf.addPage([595, 842]); const head = () => { p.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: NAVY }); p.drawRectangle({ x: 0, y: 778, width: 595, height: 4, color: ORANGE }); p.drawText(safe(SITE.name), { x: 48, y: 806, size: 18, font: B, color: rgb(1, 1, 1) }); p.drawText(safe(d.office ?? "Office of the Registrar"), { x: 48, y: 790, size: 10, font: R, color: rgb(0.8, 0.86, 0.94) }); p.drawText(safe(`${SITE.address}  |  ${SITE.phoneDisplay}  |  ${SITE.email}`), { x: 48, y: 30, size: 8, font: R, color: GREY }); };
  head(); let y = 740; p.drawText(day(d.date), { x: 48, y, size: 10, font: R, color: GREY }); p.drawText(safe(`Ref: ${d.docId}`), { x: 595 - 48 - B.widthOfTextAtSize(safe(`Ref: ${d.docId}`), 10), y, size: 10, font: B, color: NAVY }); y -= 34;
  p.drawText(safe(d.title.toUpperCase()), { x: 48, y, size: 15, font: B, color: BLUE }); y -= 28;
  if (d.salutation) { p.drawText(safe(d.salutation), { x: 48, y, size: 11, font: R, color: NAVY }); y -= 22; }
  for (const t of d.paragraphs) y = para(p, t, 48, y, 499, R, 11) - 8;
  if (d.table) { const X = (i: number) => 48 + d.table!.widths.slice(0, i).reduce((a, b) => a + b, 0); const row = (cells: string[], f: PDFFont, bg?: boolean) => { if (y < 190) { p = pdf.addPage([595, 842]); head(); y = 740; } if (bg) p.drawRectangle({ x: 48, y: y - 5, width: 499, height: 17, color: rgb(0.93, 0.95, 0.98) }); cells.forEach((c, i) => { let s = safe(c); while (s.length > 3 && f.widthOfTextAtSize(s, 9) > d.table!.widths[i] - 6) s = s.slice(0, -2); p.drawText(s, { x: X(i) + 3, y, size: 9, font: f, color: NAVY }); }); y -= 17; };
    row(d.table.head, B, true); for (const r of d.table.rows) row(r, R); y -= 10; }
  if (d.footer) y = para(p, d.footer, 48, y, 499, R, 11) - 8;
  if (y < 200) { p = pdf.addPage([595, 842]); head(); y = 740; }
  y -= 14; p.drawText(safe(d.signatory ?? "Office of the Registrar"), { x: 48, y, size: 11, font: B, color: NAVY }); y -= 14; p.drawText(safe(SITE.name), { x: 48, y, size: 10, font: R, color: GREY });
  p.drawImage(qr, { x: 447, y: 62, width: 100, height: 100 }); p.drawText("Scan to verify this document", { x: 48, y: 140, size: 10, font: B, color: NAVY }); p.drawText(`Verification code: ${docCode(d.docId)}`, { x: 48, y: 125, size: 10, font: R, color: NAVY });
  p.drawText(safe(`Or open ${SITE.url}/verify and enter the reference and code.`), { x: 48, y: 110, size: 9, font: R, color: GREY }); p.drawText("Issued electronically. Valid only when verified with the code above.", { x: 48, y: 96, size: 8, font: I, color: GREY });
  return pdf.save();
}
