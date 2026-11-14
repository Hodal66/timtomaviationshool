import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { notifyApplicant, type Msg } from "./notify";
import { SITE } from "./site";
import type { AttendanceStatus } from "@prisma/client";

const secret = () => process.env.AUTH_SECRET ?? "";
const sign = (s: string, n = 16) => createHmac("sha256", secret()).update(s).digest("hex").slice(0, n);
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
export const THRESHOLD = 80, STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];

/* ---------- TTB-01: class groups ---------- */
/** Finds the class group for an applicant's programme, branch, intake and session, creating it when it is the first student. */
export async function ensureGroup(a: { programmeId: string; branchId: string; intakeId: string; session: "WEEKDAY" | "WEEKEND" }) {
  const where = { programmeId: a.programmeId, branchId: a.branchId, intakeId: a.intakeId, session: a.session };
  const found = await db.classGroup.findFirst({ where }); if (found) return found;
  const [p, b, i] = await Promise.all([db.programme.findUniqueOrThrow({ where: { id: a.programmeId }, select: { code: true } }), db.branch.findUniqueOrThrow({ where: { id: a.branchId }, select: { code: true } }), db.intake.findUniqueOrThrow({ where: { id: a.intakeId }, select: { label: true } })]);
  const name = `${p.code} ${b.code} ${i.label} ${a.session === "WEEKDAY" ? "WD" : "WE"}`;
  return db.classGroup.upsert({ where: { name }, update: {}, create: { name, ...where } });
}

/* ---------- ATT-01: rotating QR code ---------- */
export const QR_SLICE_MS = 30_000;
/** The code shown in class changes every 30 seconds. The current and the previous code are accepted, so a scan is valid for 30 to 60 seconds. */
export const qrCodeFor = (sessionId: string, at = Date.now()) => sign(`att|${sessionId}|${Math.floor(at / QR_SLICE_MS)}`, 10);
export const qrCodeOk = (sessionId: string, code: string, at = Date.now()) => !!code && (same(code, qrCodeFor(sessionId, at)) || same(code, qrCodeFor(sessionId, at - QR_SLICE_MS)));
/** A scan after the first 15 minutes of class counts as late. */
export const scanStatus = (startMin: number, nowMin: number): AttendanceStatus => (nowMin > startMin + 15 ? "LATE" : "PRESENT");
/** Minutes after midnight in Kigali (UTC+2, no daylight saving). */
export const kigaliMinutes = (d = new Date()) => ((d.getUTCHours() + 2) % 24) * 60 + d.getUTCMinutes();
export const kigaliDate = (d = new Date()) => { const k = new Date(+d + 2 * 3600e3); return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate())); };
export const kigaliDow = (d = new Date()) => ((kigaliDate(d).getUTCDay() + 6) % 7) + 1;

/* ---------- attendance rules ---------- */
export const attended = (s: string) => s === "PRESENT" || s === "LATE" || s === "EXCUSED";
/** Percentage of recorded sessions attended, or null when nothing is recorded yet. */
export const rateOf = (statuses: string[]) => (statuses.length ? Math.round((statuses.filter(attended).length / statuses.length) * 100) : null);

export type Mark = { applicantId: string; status: string };
/** Saves marks for one class on one date. Safe to repeat (offline sync sends the same marks again). A roll-call never downgrades nothing: the latest mark wins. */
export async function saveMarks(slotId: string, dateISO: string, marks: Mark[], method: "ROLL" | "QR" | "OFFLINE") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { error: "Bad date." as const };
  const slot = await db.timetableSlot.findUnique({ where: { id: slotId }, select: { groupId: true } }); if (!slot) return { error: "Class not found." as const };
  const date = new Date(dateISO + "T00:00:00Z"); const ids = new Set((await db.applicant.findMany({ where: { classGroupId: slot.groupId }, select: { id: true } })).map((a) => a.id));
  const session = await db.classSession.upsert({ where: { slotId_date: { slotId, date } }, update: {}, create: { slotId, date } }); let saved = 0;
  for (const m of marks.slice(0, 500)) { if (!ids.has(m.applicantId) || !STATUSES.includes(m.status as AttendanceStatus)) continue; const status = m.status as AttendanceStatus;
    await db.attendance.upsert({ where: { applicantId_sessionId: { applicantId: m.applicantId, sessionId: session.id } }, update: { status, method, markedAt: new Date() }, create: { applicantId: m.applicantId, sessionId: session.id, status, method } }); saved++; }
  await alertLowAttendance(slot.groupId);
  return { saved, sessionId: session.id };
}

/** ATT-03: tells a student (once a week at most) when their attendance is under the threshold, after at least 3 recorded sessions. Returns who was alerted. */
export async function alertLowAttendance(groupId: string, now = new Date()) {
  const students = await db.applicant.findMany({ where: { classGroupId: groupId, status: "ENROLLED" }, select: { id: true, attendanceAlertAt: true, attendance: { where: { session: { slot: { groupId } } }, select: { status: true } } } });
  const out: string[] = [];
  for (const s of students) { const r = rateOf(s.attendance.map((x) => x.status)); if (r === null || s.attendance.length < 3 || r >= THRESHOLD) continue; if (s.attendanceAlertAt && +now - +s.attendanceAlertAt < 7 * 864e5) continue;
    await db.applicant.update({ where: { id: s.id }, data: { attendanceAlertAt: now, events: { create: { type: "SYSTEM", actorName: "System", message: `Attendance alert sent: ${r}% (below ${THRESHOLD}%).` } } } });
    await notifyApplicant(s.id, (a): Msg => ({ template: "attendance_low", subject: `Your attendance is ${r}%`, text: `Hello ${a.fullName.split(" ")[0]},\n\nYour attendance in ${a.programme.name} is ${r}%, below the ${THRESHOLD}% the School requires. Please attend every session, and speak to your lecturer or the branch office if something is stopping you.\n${SITE.url}/me\n\n${SITE.name}` })); out.push(s.id); }
  return out;
}

/* ---------- TTB-03: calendar feeds ---------- */
export const calToken = (kind: "g" | "l", id: string) => `${kind}-${id}-${sign(`cal|${kind}|${id}`, 20)}`;
export function readCalToken(token: string): { kind: "g" | "l"; id: string } | null { const m = token.match(/^(g|l)-([a-z0-9]+)-([0-9a-f]{20})$/i); if (!m) return null; return same(token, calToken(m[1] as "g", m[2])) ? { kind: m[1] as "g" | "l", id: m[2] } : null; }
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const BYDAY = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"]; const pad = (n: number) => String(n).padStart(2, "0");
export type CalSlot = { id: string; subject: string; dayOfWeek: number; startMin: number; endMin: number; room: string; lecturer: string; group: string; from: Date; months: number; join?: string };
/** A subscribable iCalendar feed: one weekly repeating event per class, in Kigali time, for the length of the programme. */
export function buildIcs(name: string, slots: CalSlot[], now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Timtom Aviation School//TAS-One//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:Africa/Kigali", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
  for (const s of slots) {
    const first = new Date(Date.UTC(s.from.getUTCFullYear(), s.from.getUTCMonth(), s.from.getUTCDate())); first.setUTCDate(first.getUTCDate() + ((s.dayOfWeek - (((first.getUTCDay() + 6) % 7) + 1) + 7) % 7));
    const until = new Date(Date.UTC(s.from.getUTCFullYear(), s.from.getUTCMonth() + Math.max(1, s.months), s.from.getUTCDate()));
    const d = `${first.getUTCFullYear()}${pad(first.getUTCMonth() + 1)}${pad(first.getUTCDate())}`; const t = (m: number) => `${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
    L.push("BEGIN:VEVENT", `UID:${s.id}@tas-one`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Africa/Kigali:${d}T${t(s.startMin)}`, `DTEND;TZID=Africa/Kigali:${d}T${t(s.endMin)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.dayOfWeek]};UNTIL=${until.getUTCFullYear()}${pad(until.getUTCMonth() + 1)}${pad(until.getUTCDate())}T215959Z`, `SUMMARY:${esc(s.subject)}`, `LOCATION:${esc(s.room)}`, `DESCRIPTION:${esc(`${s.group}. Lecturer: ${s.lecturer}.${s.join ? ` Join online: ${s.join}` : ""}`)}`, ...(s.join ? [`URL:${s.join}`] : []), "END:VEVENT");
  }
  L.push("END:VCALENDAR"); return L.join("\r\n") + "\r\n";
}
