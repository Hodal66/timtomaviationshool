import { db } from "@/lib/db";
import { getApplicantEmail } from "@/lib/otp";
import { qrCodeOk, scanStatus, kigaliMinutes, kigaliDate } from "@/lib/teaching";
import { limited, clientIp } from "@/lib/ratelimit";
/** A student scans the code shown in class. They must be signed in, enrolled in that class group, and the code must be the current one. */
export async function POST(req: Request) {
  const email = await getApplicantEmail(); if (!email) return Response.json({ ok: false, error: "Sign in first.", signIn: true }, { status: 401 });
  if (limited(`apply-checkin:${clientIp(req.headers)}`, 20, 60e3)) return Response.json({ ok: false, error: "Too many attempts. Wait a minute." }, { status: 429 });
  const b = await req.json().catch(() => null); const sessionId = String(b?.s ?? ""), code = String(b?.c ?? "");
  const session = await db.classSession.findUnique({ where: { id: sessionId }, include: { slot: { include: { group: true } } } });
  if (!session || !qrCodeOk(sessionId, code)) return Response.json({ ok: false, error: "This code has expired. Scan the code on the screen again." }, { status: 400 });
  if (+session.date !== +kigaliDate()) return Response.json({ ok: false, error: "This class is not today." }, { status: 400 });
  const me = await db.applicant.findFirst({ where: { email, classGroupId: session.slot.groupId, status: "ENROLLED" } });
  if (!me) return Response.json({ ok: false, error: "You are not enrolled in this class group." }, { status: 403 });
  const existing = await db.attendance.findUnique({ where: { applicantId_sessionId: { applicantId: me.id, sessionId } } });
  const status = existing && existing.status !== "ABSENT" ? existing.status : scanStatus(session.slot.startMin, kigaliMinutes());
  await db.attendance.upsert({ where: { applicantId_sessionId: { applicantId: me.id, sessionId } }, update: { status, method: "QR", markedAt: new Date() }, create: { applicantId: me.id, sessionId, status, method: "QR" } });
  return Response.json({ ok: true, status, subject: session.slot.subject, group: session.slot.group.name, name: me.fullName });
}
