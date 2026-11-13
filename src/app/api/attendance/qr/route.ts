import QRCode from "qrcode";
import { db } from "@/lib/db";
import { teacherOf } from "@/lib/teach-auth";
import { qrCodeFor, QR_SLICE_MS, kigaliDate, kigaliDow } from "@/lib/teaching";
import { SITE } from "@/lib/site";
/** The lecturer's screen asks for the current QR code of today's session of a class. It changes every 30 seconds. */
export async function GET(req: Request) {
  const slotId = new URL(req.url).searchParams.get("slot") ?? ""; const t = await teacherOf(slotId); if (!t) return new Response("Forbidden", { status: 403 });
  if (t.slot.dayOfWeek !== kigaliDow()) return Response.json({ error: "QR check-in is available on the day of the class." }, { status: 409 });
  const date = kigaliDate(); const session = await db.classSession.upsert({ where: { slotId_date: { slotId, date } }, update: {}, create: { slotId, date } });
  const code = qrCodeFor(session.id); const url = `${SITE.url}/checkin?s=${session.id}&c=${code}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 320, errorCorrectionLevel: "M" });
  const present = await db.attendance.count({ where: { sessionId: session.id, status: { in: ["PRESENT", "LATE"] } } });
  return Response.json({ svg, url, expiresInMs: QR_SLICE_MS - (Date.now() % QR_SLICE_MS), present, date: date.toISOString().slice(0, 10) }, { headers: { "cache-control": "no-store" } });
}
