import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getApplicantEmail } from "@/lib/otp";
/** VCL-02: one-tap Join. Only the class's students and staff are sent to the meeting, so the link is not public. */
export async function GET(_: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const slot = await db.timetableSlot.findUnique({ where: { id: (await params).slotId }, select: { groupId: true, meetUrl: true, mode: true } }); if (!slot) return new Response("Class not found", { status: 404 });
  const s = await getSession(); let ok = !!s;
  if (!ok) { const email = await getApplicantEmail(); ok = !!email && (await db.applicant.count({ where: { email, classGroupId: slot.groupId, status: "ENROLLED" } })) > 0; }
  if (!ok) return new Response("Sign in to join your class.", { status: 403 });
  if (slot.mode === "CAMPUS" || !slot.meetUrl) return new Response("This class has no online meeting yet.", { status: 409 });
  return new Response(null, { status: 302, headers: { location: slot.meetUrl, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
