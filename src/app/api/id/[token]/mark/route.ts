import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { readIdToken } from "@/lib/student";
import { saveMarks, kigaliDow, kigaliDate, kigaliMinutes, scanStatus } from "@/lib/teaching";
/** STU-12: a lecturer scans a student's ID card and marks them present in the class they are teaching today. */
export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const s = await getSession(); const id = readIdToken(decodeURIComponent((await params).token)); if (!s || !id) return Response.json({ ok: false, error: "Not allowed." }, { status: 403 });
  const st = await db.applicant.findUnique({ where: { id } }); if (!st?.classGroupId || st.status !== "ENROLLED") return Response.json({ ok: false, error: "This student is not in a class group." }, { status: 400 });
  const slots = await db.timetableSlot.findMany({ where: { groupId: st.classGroupId, dayOfWeek: kigaliDow(), ...(s.role === "LECTURER" ? { lecturerId: s.uid } : {}) }, orderBy: { startMin: "asc" } });
  if (!["ADMIN", "BRANCH_MANAGER", "LECTURER"].includes(s.role) || !slots.length) return Response.json({ ok: false, error: "You have no class with this student today." }, { status: 403 });
  const now = kigaliMinutes(); const slot = slots.find((x) => now <= x.endMin) ?? slots[slots.length - 1]; const status = scanStatus(slot.startMin, now);
  await saveMarks(slot.id, kigaliDate().toISOString().slice(0, 10), [{ applicantId: id, status }], "QR");
  return Response.json({ ok: true, status, subject: slot.subject });
}
