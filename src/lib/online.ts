import { createSign } from "node:crypto";
import type { AttendanceStatus } from "@prisma/client";
import { db } from "./db";
import { parseCsv, type Actor } from "./lecturers";
import { alertLowAttendance, kigaliDate, STATUSES } from "./teaching";
import { notifyApplicant, type Msg } from "./notify";
import { SITE } from "./site";

export const MODES = ["CAMPUS", "ONLINE", "HYBRID"] as const;
const STAFF = ["ADMIN", "ACADEMIC", "BRANCH_MANAGER"];
export const MEET_RE = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\?.*)?$/;
/** VCL-05: per-programme rules. Defaults from the SRS: present at 75% of the session, late after 10 minutes, left early before the last 15. */
export type Rules = { presentPct: number; lateMin: number; earlyMin: number };
export const DEFAULT_RULES: Rules = { presentPct: 75, lateMin: 10, earlyMin: 15 };
export function rulesOf(v: unknown): Rules { const r = (v ?? {}) as Partial<Rules>; const n = (x: unknown, d: number, lo: number, hi: number) => (Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi ? (x as number) : d); return { presentPct: n(r.presentPct, 75, 1, 100), lateMin: n(r.lateMin, 10, 0, 120), earlyMin: n(r.earlyMin, 15, 0, 120) }; }
export function cleanRules(d: { presentPct?: string; lateMin?: string; earlyMin?: string }): string | Rules {
  const p = Number(d.presentPct), l = Number(d.lateMin), e = Number(d.earlyMin); if (!Number.isInteger(p) || p < 1 || p > 100) return "The share of the session is a whole number from 1 to 100."; if (!Number.isInteger(l) || l < 0 || l > 120 || !Number.isInteger(e) || e < 0 || e > 120) return "Minutes are whole numbers from 0 to 120."; return { presentPct: p, lateMin: l, earlyMin: e };
}
/** One student's online result for a session. Times are minutes from midnight (Kigali). `join` null = never joined. */
export function classify(r: Rules, startMin: number, endMin: number, join: number | null, leave: number | null, minutes: number | null): { status: AttendanceStatus; note: string | null } {
  if (join === null) return { status: "ABSENT", note: null }; const len = Math.max(1, endMin - startMin); const stayed = minutes ?? Math.max(0, Math.min(leave ?? endMin, endMin) - Math.max(join, startMin)); const pct = Math.min(100, Math.round((stayed / len) * 100));
  const late = join > startMin + r.lateMin, early = leave !== null && leave < endMin - r.earlyMin; const bits = [`${stayed} min online (${pct}%)`, late && `joined ${join - startMin} min late`, early && `left ${endMin - leave!} min early`].filter(Boolean).join(", ");
  if (pct < r.presentPct) return { status: "ABSENT", note: `${bits}; below the ${r.presentPct}% needed` }; return { status: late ? "LATE" : "PRESENT", note: bits };
}

/* ---------- VCL-01: the meeting ---------- */
/** Automatic creation needs a Google Workspace service account with domain-wide delegation for the Calendar API. */
export const meetConfigured = () => !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_KEY && process.env.GOOGLE_CALENDAR_USER);
const b64 = (v: string | Buffer) => Buffer.from(v).toString("base64url");
async function googleToken(scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000); const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" })), body = b64(JSON.stringify({ iss: process.env.GOOGLE_SA_EMAIL, sub: process.env.GOOGLE_CALENDAR_USER, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3000 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign((process.env.GOOGLE_SA_KEY ?? "").replace(/\\n/g, "\n")).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; error_description?: string }; if (!r.ok || !j.access_token) throw new Error(j.error_description ?? "Google sign-in failed."); return j.access_token;
}
const BYDAY = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"]; const pad = (n: number) => String(n).padStart(2, "0");
/** The Calendar API request for a weekly class with a Meet link and the class group as guests. Exported for tests. */
export function calendarEvent(s: { id: string; subject: string; dayOfWeek: number; startMin: number; endMin: number; group: string; from: Date; until: Date; guests: string[] }) {
  const first = new Date(Date.UTC(s.from.getUTCFullYear(), s.from.getUTCMonth(), s.from.getUTCDate())); first.setUTCDate(first.getUTCDate() + ((s.dayOfWeek - (((first.getUTCDay() + 6) % 7) + 1) + 7) % 7)); const d = first.toISOString().slice(0, 10); const t = (m: number) => `${d}T${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`;
  return { summary: `${s.subject} (${s.group})`, description: `Online class. Join from TAS-One: ${SITE.url}/me`, start: { dateTime: t(s.startMin), timeZone: "Africa/Kigali" }, end: { dateTime: t(s.endMin), timeZone: "Africa/Kigali" },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.dayOfWeek]};UNTIL=${s.until.toISOString().slice(0, 10).replace(/-/g, "")}T215959Z`], attendees: s.guests.map((email) => ({ email })), conferenceData: { createRequest: { requestId: `tas-${s.id}`, conferenceSolutionKey: { type: "hangoutsMeet" } } }, guestsCanInviteOthers: false };
}
/** Set how a class is delivered. Online and hybrid classes need a Meet link: created through Google when configured, otherwise pasted by staff. */
export async function setDelivery(a: Actor, slotId: string, mode: string, link?: string): Promise<string | { meetUrl: string | null; auto: boolean }> {
  const slot = await db.timetableSlot.findUnique({ where: { id: slotId }, include: { group: { include: { intake: true, programme: true, students: { where: { status: "ENROLLED" }, select: { email: true, schoolEmail: true } } } } } }); if (!slot) return "Class not found.";
  if (!(STAFF.includes(a.role) || (a.role === "LECTURER" && slot.lecturerId === a.uid))) return "Not allowed."; if (!(MODES as readonly string[]).includes(mode)) return "Choose campus, online or hybrid.";
  if (mode === "CAMPUS") { await db.timetableSlot.update({ where: { id: slotId }, data: { mode } }); return { meetUrl: slot.meetUrl, auto: false }; }
  const url = (link ?? "").trim(); if (url) { if (!MEET_RE.test(url)) return "Paste a Google Meet link like https://meet.google.com/abc-defg-hij."; await db.timetableSlot.update({ where: { id: slotId }, data: { mode, meetUrl: url.split("?")[0] } }); return { meetUrl: url.split("?")[0], auto: false }; }
  if (slot.meetUrl) { await db.timetableSlot.update({ where: { id: slotId }, data: { mode } }); return { meetUrl: slot.meetUrl, auto: false }; }
  if (!meetConfigured()) return "Paste the Google Meet link for this class. Automatic creation needs the School's Google Workspace connection, which is not set up yet.";
  try { const from = slot.group.intake.startsOn > kigaliDate() ? slot.group.intake.startsOn : kigaliDate(); const until = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + Math.max(1, slot.group.programme.durationMonths ?? 6), from.getUTCDate()));
    const ev = calendarEvent({ id: slot.id, subject: slot.subject, dayOfWeek: slot.dayOfWeek, startMin: slot.startMin, endMin: slot.endMin, group: slot.group.name, from, until, guests: slot.group.students.map((s) => s.schoolEmail ?? s.email).filter(Boolean) as string[] });
    const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", { method: "POST", headers: { authorization: `Bearer ${await googleToken("https://www.googleapis.com/auth/calendar.events")}`, "content-type": "application/json" }, body: JSON.stringify(ev) });
    const j = (await r.json().catch(() => ({}))) as { id?: string; hangoutLink?: string; error?: { message?: string } }; if (!r.ok || !j.hangoutLink) return `Google did not create the meeting: ${j.error?.message ?? r.status}. Paste a Meet link instead.`;
    await db.timetableSlot.update({ where: { id: slotId }, data: { mode, meetUrl: j.hangoutLink, meetEventId: j.id ?? null } }); return { meetUrl: j.hangoutLink, auto: true };
  } catch (e) { return `Google did not create the meeting: ${(e as Error).message}. Paste a Meet link instead.`; }
}

/* ---------- VCL-04: Meet attendance report ---------- */
export type MeetRow = { email: string; name: string; join: number | null; leave: number | null; minutes: number | null };
/** "1 hr 5 min", "45 min", "01:05:00" or "65" -> minutes. */
export function parseDuration(v: string): number | null { const s = (v ?? "").trim().toLowerCase(); if (!s) return null; let m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/); if (m) return m[3] !== undefined ? +m[1] * 60 + +m[2] : +m[1] * 60 + +m[2];
  m = s.match(/^(?:(\d+)\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes))?\s*(?:(\d+)\s*(?:s|sec|secs|second|seconds))?$/); if (m && (m[1] || m[2] || m[3])) return +(m[1] ?? 0) * 60 + +(m[2] ?? 0); return /^\d+$/.test(s) ? +s : null; }
/** "9:05 AM", "14:30", "2026-11-09 09:05:12" -> minutes from midnight. */
export function parseClock(v: string): number | null { const m = (v ?? "").trim().match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\s*$/i); if (!m) return null; let h = +m[1]; const ap = m[3]?.toLowerCase(); if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0; return h > 23 || +m[2] > 59 ? null : h * 60 + +m[2]; }
/** Reads the attendance report Google Meet emails to the organiser (CSV). Rows for the same email are merged: earliest join, latest exit, minutes added. */
export function parseMeetCsv(text: string): { rows: MeetRow[]; errors: string[] } {
  const t = parseCsv(text.replace(/^﻿/, "")); if (t.length < 2) return { rows: [], errors: ["The file is empty."] }; const H = t[0].map((x) => x.trim().toLowerCase()); const col = (...n: string[]) => H.findIndex((h) => n.some((x) => h === x || h.startsWith(x)));
  const e = col("email"), f = col("first name", "name", "full name", "participant"), l = col("last name"), d = col("duration", "time in call", "minutes"), j = col("time joined", "joined", "first seen", "join"), x = col("time exited", "exited", "last seen", "left", "leave");
  if (e < 0) return { rows: [], errors: ["Missing column: Email. Use the attendance report from Google Meet."] }; if (d < 0 && (j < 0 || x < 0)) return { rows: [], errors: ["The file needs a Duration column, or Time joined and Time exited."] };
  const by = new Map<string, MeetRow>(); const errors: string[] = [];
  t.slice(1).forEach((r, i) => { const email = (r[e] ?? "").trim().toLowerCase(); if (!email) return; if (!/^\S+@\S+\.\S+$/.test(email)) { errors.push(`Row ${i + 2}: "${email}" is not an email address.`); return; }
    const row: MeetRow = { email, name: [f >= 0 ? r[f] : "", l >= 0 ? r[l] : ""].join(" ").trim(), join: j >= 0 ? parseClock(r[j] ?? "") : null, leave: x >= 0 ? parseClock(r[x] ?? "") : null, minutes: d >= 0 ? parseDuration(r[d] ?? "") : null };
    const o = by.get(email); if (!o) by.set(email, row); else { o.join = o.join === null ? row.join : row.join === null ? o.join : Math.min(o.join, row.join); o.leave = o.leave === null ? row.leave : row.leave === null ? o.leave : Math.max(o.leave, row.leave); o.minutes = o.minutes === null && row.minutes === null ? null : (o.minutes ?? 0) + (row.minutes ?? 0); } });
  return { rows: [...by.values()], errors };
}
type Log = { at: string; by: string; action: string; note?: string };
const canRun = async (a: Actor, slotId: string) => { const s = await db.timetableSlot.findUnique({ where: { id: slotId }, include: { group: { include: { programme: true } } } }); if (!s) return "Class not found."; if (!(STAFF.includes(a.role) || (a.role === "LECTURER" && s.lecturerId === a.uid))) return "This is not your class."; return s; };
const sessionFor = async (slotId: string, dateISO: string, dayOfWeek: number) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return "Bad date."; const date = new Date(dateISO + "T00:00:00Z"); if (((date.getUTCDay() + 6) % 7) + 1 !== dayOfWeek) return "This class does not meet on that day."; if (+date > +kigaliDate()) return "That class has not taken place yet."; return db.classSession.upsert({ where: { slotId_date: { slotId, date } }, update: {}, create: { slotId, date } }); };
const at = (date: Date, min: number | null) => (min === null ? null : new Date(+date + (min - 120) * 60e3));
const RANK: Record<string, number> = { PRESENT: 3, LATE: 2, EXCUSED: 2, ABSENT: 0 };

/**
 * VCL-04/05/06/10: import one session's Meet report. Students are matched by School email, then personal email.
 * Hybrid merge: a campus mark (QR or roll call) is kept when it is better than the online result; online detail is still stored.
 * Students in the group but not in the report are absent unless they were marked on campus. A hand-corrected mark is never overwritten.
 */
export async function importMeetAttendance(a: Actor, slotId: string, dateISO: string, csv: string): Promise<string | { present: number; late: number; absent: number; campus: number; unmatched: string[]; warnings: string[] }> {
  const slot = await canRun(a, slotId); if (typeof slot === "string") return slot; if (slot.mode === "CAMPUS") return "This class is on campus. Change it to online or hybrid first."; const session = await sessionFor(slotId, dateISO, slot.dayOfWeek); if (typeof session === "string") return session;
  const { rows, errors } = parseMeetCsv(csv); if (!rows.length) return errors[0] ?? "No participants found in the file."; const rules = rulesOf(slot.group.programme.meetRules);
  const students = await db.applicant.findMany({ where: { classGroupId: slot.groupId, status: "ENROLLED" }, select: { id: true, email: true, schoolEmail: true } }); const existing = new Map((await db.attendance.findMany({ where: { sessionId: session.id } })).map((x) => [x.applicantId, x]));
  const used = new Set<string>(); const out = { present: 0, late: 0, absent: 0, campus: 0, unmatched: [] as string[], warnings: errors }; const tell: { id: string; status: string; note: string | null }[] = [];
  for (const s of students) { const row = rows.find((r) => r.email === s.schoolEmail?.toLowerCase()) ?? rows.find((r) => r.email === s.email?.toLowerCase()); if (row) used.add(row.email); const old = existing.get(s.id);
    const res = classify(rules, slot.startMin, slot.endMin, row ? row.join ?? slot.startMin : null, row?.leave ?? null, row?.minutes ?? null); const detail = row ? { joinAt: at(session.date, row.join), leaveAt: at(session.date, row.leave), minutes: row.minutes } : {};
    if (old?.method === "CORRECTED") { await db.attendance.update({ where: { id: old.id }, data: detail }); continue; }
    if (old && ["QR", "ROLL", "OFFLINE"].includes(old.method) && RANK[old.status] >= RANK[res.status]) { out.campus++; await db.attendance.update({ where: { id: old.id }, data: detail }); continue; }
    await db.attendance.upsert({ where: { applicantId_sessionId: { applicantId: s.id, sessionId: session.id } }, update: { status: res.status, method: "MEET", note: res.note, markedAt: new Date(), ...detail }, create: { applicantId: s.id, sessionId: session.id, status: res.status, method: "MEET", note: res.note, ...detail } });
    out[res.status === "PRESENT" ? "present" : res.status === "LATE" ? "late" : "absent"]++; if (res.status !== "PRESENT" && (!old || old.status !== res.status)) tell.push({ id: s.id, status: res.status, note: res.note }); }
  out.unmatched = rows.filter((r) => !used.has(r.email)).map((r) => (r.name ? `${r.name} <${r.email}>` : r.email));
  await db.classSession.update({ where: { id: session.id }, data: { meetImportedAt: new Date(), log: [...(session.log as Log[]), { at: new Date().toISOString(), by: a.name, action: "Meet report imported", note: `${out.present} present, ${out.late} late, ${out.absent} absent, ${out.campus} kept from campus, ${out.unmatched.length} not matched` }] as never } });
  for (const x of tell) await notifyApplicant(x.id, (p): Msg => ({ template: x.status === "LATE" ? "online_late" : "online_absent", subject: x.status === "LATE" ? `You joined ${slot.subject} late` : `You were marked absent from ${slot.subject}`,
    text: `Hello ${p.fullName.split(" ")[0]},\n\n${x.status === "LATE" ? `You joined the online class ${slot.subject} on ${dateISO} late` : `You were marked absent from the online class ${slot.subject} on ${dateISO}`}${x.note ? ` (${x.note})` : ""}. If this is wrong, tell your lecturer today so it can be corrected.\n${SITE.url}/me\n\n${SITE.name}` }));
  await alertLowAttendance(slot.groupId); return out;
}
/** VCL-07: the lecturer corrects one mark with a reason. The change is written to the session log and later imports leave it alone. */
export async function correctAttendance(a: Actor, slotId: string, dateISO: string, applicantId: string, status: string, reason: string): Promise<string | null> {
  const slot = await canRun(a, slotId); if (typeof slot === "string") return slot; if (!STATUSES.includes(status as AttendanceStatus)) return "Unknown status."; const why = (reason ?? "").trim().slice(0, 300); if (why.length < 5) return "Give a reason for the correction.";
  const st = await db.applicant.findFirst({ where: { id: applicantId, classGroupId: slot.groupId }, select: { fullName: true } }); if (!st) return "That student is not in this class."; const session = await sessionFor(slotId, dateISO, slot.dayOfWeek); if (typeof session === "string") return session;
  const old = await db.attendance.findUnique({ where: { applicantId_sessionId: { applicantId, sessionId: session.id } } }); if (old?.status === status) return "The mark is already that.";
  await db.attendance.upsert({ where: { applicantId_sessionId: { applicantId, sessionId: session.id } }, update: { status: status as AttendanceStatus, method: "CORRECTED", note: `Corrected by ${a.name}: ${why}`, markedAt: new Date() }, create: { applicantId, sessionId: session.id, status: status as AttendanceStatus, method: "CORRECTED", note: `Corrected by ${a.name}: ${why}` } });
  await db.classSession.update({ where: { id: session.id }, data: { log: [...(session.log as Log[]), { at: new Date().toISOString(), by: a.name, action: `Corrected ${st.fullName}: ${old?.status ?? "no mark"} -> ${status}`, note: why }] as never } }); await alertLowAttendance(slot.groupId); return null;
}
/** VCL-11: no Meet data for a session. The gap is logged; the lecturer then marks the register by hand. */
export async function logMeetGap(a: Actor, slotId: string, dateISO: string, reason: string): Promise<string | null> {
  const slot = await canRun(a, slotId); if (typeof slot === "string") return slot; const why = (reason ?? "").trim().slice(0, 300); if (why.length < 5) return "Say why the Meet data is not available."; const session = await sessionFor(slotId, dateISO, slot.dayOfWeek); if (typeof session === "string") return session;
  await db.classSession.update({ where: { id: session.id }, data: { log: [...(session.log as Log[]), { at: new Date().toISOString(), by: a.name, action: "Meet data unavailable: register marked by hand", note: why }] as never } }); return null;
}
/** VCL-08: publish a session recording to the class's resources. Only that class group can open it; it is view-only. */
export async function publishRecording(a: Actor, slotId: string, dateISO: string, url: string): Promise<string | { id: string }> {
  const slot = await canRun(a, slotId); if (typeof slot === "string") return slot; const session = await sessionFor(slotId, dateISO, slot.dayOfWeek); if (typeof session === "string") return session;
  let u: URL; try { u = new URL((url ?? "").trim()); } catch { return "Paste the recording link from Google Drive."; } if (u.protocol !== "https:") return "Links must start with https://.";
  const title = `Recording: ${slot.subject}, ${dateISO}`; if (await db.resource.findFirst({ where: { groupId: slot.groupId, title, deletedAt: null } })) return "A recording for this session is already published.";
  const r = await db.resource.create({ data: { title, kind: "VIDEO", programmeId: slot.group.programmeId, groupId: slot.groupId, module: slot.subject, ownerId: a.uid, status: "APPROVED", reviewedBy: a.name, visibility: "STUDENTS", viewOnly: true, licence: "School copyright", tags: ["recording"], versions: { create: { version: 1, url: u.toString().slice(0, 500), uploadedBy: a.name, note: "Class recording" } } } });
  await db.classSession.update({ where: { id: session.id }, data: { log: [...(session.log as Log[]), { at: new Date().toISOString(), by: a.name, action: "Recording published" }] as never } }); return { id: r.id };
}
