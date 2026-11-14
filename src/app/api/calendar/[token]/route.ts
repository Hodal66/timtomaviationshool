import { SITE } from "@/lib/site";
import { db } from "@/lib/db";
import { buildIcs, readCalToken, type CalSlot } from "@/lib/teaching";
/** TTB-03: calendar feed for a class group (students) or a lecturer. The signed link is the key; add it to Google, Outlook or a phone calendar. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const t = readCalToken(decodeURIComponent((await params).token).replace(/\.ics$/i, "")); if (!t) return new Response("Not found", { status: 404 });
  const slots = await db.timetableSlot.findMany({ where: t.kind === "g" ? { groupId: t.id } : { lecturerId: t.id }, include: { room: true, lecturer: true, group: { include: { intake: true, programme: { select: { durationMonths: true } } } } } });
  const name = t.kind === "g" ? (await db.classGroup.findUnique({ where: { id: t.id } }))?.name : (await db.user.findUnique({ where: { id: t.id } }))?.name; if (!name) return new Response("Not found", { status: 404 });
  const cal: CalSlot[] = slots.map((s) => ({ id: s.id, subject: s.subject, dayOfWeek: s.dayOfWeek, startMin: s.startMin, endMin: s.endMin, room: s.mode === "ONLINE" ? "Online (Google Meet)" : s.mode === "HYBRID" ? `${s.room.name} or online` : s.room.name, join: s.mode !== "CAMPUS" && s.meetUrl ? `${SITE.url}/api/join/${s.id}` : undefined, lecturer: s.lecturer.name, group: s.group.name, from: s.group.intake.startsOn, months: s.group.programme.durationMonths ?? 3 }));
  return new Response(buildIcs(`Timtom: ${name}`, cal), { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="timetable.ics"', "cache-control": "private, max-age=900" } });
}
