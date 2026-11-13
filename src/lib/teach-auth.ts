import { getSession } from "./session";
import { db } from "./db";
/** Who may record attendance for a class: administrators and branch managers, or the lecturer who teaches it. */
export async function teacherOf(slotId: string) {
  const s = await getSession(); if (!s) return null;
  const slot = await db.timetableSlot.findUnique({ where: { id: slotId }, include: { group: true } }); if (!slot) return null;
  if (s.role === "ADMIN" || s.role === "BRANCH_MANAGER" || (s.role === "LECTURER" && slot.lecturerId === s.uid)) return { s, slot };
  return null;
}
