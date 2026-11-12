import { db } from "./db";

/** Returns a message if the proposed slot overlaps another slot for the same lecturer, room or group. */
export async function findClash(p: { groupId: string; roomId: string; lecturerId: string; dayOfWeek: number; startMin: number; endMin: number; ignoreId?: string }) {
  const hit = await db.timetableSlot.findFirst({
    where: {
      id: p.ignoreId ? { not: p.ignoreId } : undefined,
      dayOfWeek: p.dayOfWeek, startMin: { lt: p.endMin }, endMin: { gt: p.startMin },
      OR: [{ groupId: p.groupId }, { roomId: p.roomId }, { lecturerId: p.lecturerId }],
    },
    include: { group: true, room: true, lecturer: true },
  });
  if (!hit) return null;
  if (hit.lecturerId === p.lecturerId) return `${hit.lecturer.name} already teaches ${hit.group.name} at that time.`;
  if (hit.roomId === p.roomId) return `${hit.room.name} is already booked by ${hit.group.name} at that time.`;
  return `${hit.group.name} already has a class at that time.`;
}
