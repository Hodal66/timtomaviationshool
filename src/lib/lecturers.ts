import { db } from "./db";
import { asModules } from "./catalogue";
import { kigaliDate } from "./teaching";
import { cleanPhone } from "./apply";

export type Actor = { uid: string; name: string; role: string };
export const MANAGERS = ["ADMIN", "ACADEMIC", "BRANCH_MANAGER"];
export const PAY_MODELS = ["HOUR", "SESSION", "MODULE", "MONTHLY"] as const;
/** Fields only a second approver can change (LEC-03). */
export const SENSITIVE = ["rate", "payModel", "currency", "payChannel", "bankName", "accountNumber"] as const;
const PLAIN = ["phone", "nationalId", "qualifications", "licences", "industryRole", "taxStatus", "maxHoursWeek", "contractStart", "contractEnd", "subjects", "languages", "branchIds"] as const;
type Field = (typeof SENSITIVE)[number] | (typeof PLAIN)[number];
export type ProfileInput = Partial<Record<Field, string | string[] | number | null>>;

const list = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(/[,;\n]/)).map((x) => String(x).trim()).filter(Boolean).slice(0, 30);
const dateOrNull = (v: unknown) => { const s = String(v ?? ""); if (!s) return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined; return new Date(s + "T00:00:00Z"); };
/** Turns form input into clean profile values, or an error message. */
export function cleanProfile(d: ProfileInput): Record<string, unknown> | string {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(d) as Field[]) { const v = d[k];
    if (k === "subjects" || k === "languages" || k === "branchIds") out[k] = list(v);
    else if (k === "rate") { const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > 1e8) return "The rate must be a whole number of zero or more."; out.rate = n; }
    else if (k === "maxHoursWeek") { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 60) return "Maximum hours a week must be between 1 and 60."; out.maxHoursWeek = n; }
    else if (k === "payModel") { if (!PAY_MODELS.includes(v as "HOUR")) return "Choose a pay model."; out.payModel = v; }
    else if (k === "currency") { if (v !== "RWF" && v !== "USD") return "Pay is in RWF or USD."; out.currency = v; }
    else if (k === "payChannel") { if (v !== "BANK" && v !== "MOMO") return "Pay by bank or MoMo."; out.payChannel = v; }
    else if (k === "contractStart" || k === "contractEnd") { const x = dateOrNull(v); if (x === undefined) return "Check the contract dates."; out[k] = x; }
    else if (k === "phone") { const p = cleanPhone(String(v ?? "")); if (p && p.replace(/\D/g, "").length < 9) return "That phone number looks too short."; out.phone = p || null; }
    else out[k] = String(v ?? "").trim().slice(0, 600) || null; }
  if (out.contractStart instanceof Date && out.contractEnd instanceof Date && out.contractEnd < out.contractStart) return "The contract cannot end before it starts.";
  return out;
}

/** LEC-01: a lecturer is a staff account with the LECTURER role plus a profile. */
export async function createLecturer(a: Actor, d: { name: string; email: string; password: string } & ProfileInput): Promise<string | { id: string }> {
  if (!MANAGERS.includes(a.role)) return "Not allowed."; const name = (d.name ?? "").trim().slice(0, 80), email = (d.email ?? "").trim().toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return "Enter a name and a valid email."; if ((d.password ?? "").length < 10) return "The first password needs at least 10 characters.";
  if (await db.user.findUnique({ where: { email } })) return "That email already has an account.";
  const { name: _n, email: _e, password: _p, ...rest } = d; void _n; void _e; void _p; const prof = cleanProfile(rest); if (typeof prof === "string") return prof;
  const bcrypt = (await import("bcryptjs")).default; const u = await db.user.create({ data: { name, email, role: "LECTURER", passwordHash: await bcrypt.hash(d.password, 10), lecturer: { create: prof as never } } }); return { id: u.id };
}
/** LEC-03: ordinary fields change at once; sensitive ones (pay and bank) wait for a second person's approval. Lecturers may change only their own contact and availability. */
export async function updateLecturer(a: Actor, userId: string, d: ProfileInput): Promise<string | { pending: boolean }> {
  const self = a.uid === userId; if (!MANAGERS.includes(a.role) && !(self && a.role === "LECTURER")) return "Not allowed.";
  const allowed = self && !MANAGERS.includes(a.role) ? ["phone", "languages", "qualifications", "licences", "accountNumber", "bankName", "payChannel"] : [...PLAIN, ...SENSITIVE];
  const bad = Object.keys(d).filter((k) => !allowed.includes(k)); if (bad.length) return "You cannot change: " + bad.join(", ") + ".";
  const clean = cleanProfile(d); if (typeof clean === "string") return clean; const cur = await db.lecturerProfile.findUnique({ where: { userId } }); if (!cur) return "Lecturer not found.";
  const sens: Record<string, unknown> = {}, plain: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(clean)) { const before = (cur as Record<string, unknown>)[k]; const same = JSON.stringify(before ?? null) === JSON.stringify(v ?? null); if (same) continue; (SENSITIVE.includes(k as "rate") ? sens : plain)[k] = v; }
  if (Object.keys(plain).length) await db.lecturerProfile.update({ where: { userId }, data: { ...plain, updatedAt: new Date() } as never });
  if (Object.keys(sens).length) { await db.profileChange.updateMany({ where: { userId, status: "PENDING" }, data: { status: "SUPERSEDED" } });
    await db.profileChange.create({ data: { userId, fields: sens as never, previous: Object.fromEntries(Object.keys(sens).map((k) => [k, (cur as Record<string, unknown>)[k] ?? null])) as never, requestedBy: a.name, requestedById: a.uid } }); }
  return { pending: Object.keys(sens).length > 0 };
}
/** A sensitive change is applied only when someone other than the requester approves it (Finance or an administrator). Logged either way. */
export async function decideChange(a: Actor, id: string, approve: boolean): Promise<string | null> {
  if (!["ADMIN", "FINANCE"].includes(a.role)) return "Only Finance or an administrator can approve pay and bank changes."; const c = await db.profileChange.findUnique({ where: { id } }); if (!c || c.status !== "PENDING") return "Nothing to decide.";
  if (c.requestedById === a.uid) return "A change must be approved by someone other than the person who asked for it.";
  if (approve) await db.lecturerProfile.update({ where: { userId: c.userId }, data: { ...(c.fields as object), updatedAt: new Date() } as never });
  await db.profileChange.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", decidedBy: a.name, decidedAt: new Date() } }); return null;
}
/** LEC-04: archive keeps everything and stops sign-in; reactivation is one click. Future classes must be reassigned first. */
export async function setActive(a: Actor, userId: string, active: boolean): Promise<string | null> {
  if (!MANAGERS.includes(a.role)) return "Not allowed."; const u = await db.user.findUnique({ where: { id: userId } }); if (!u || u.role !== "LECTURER") return "Lecturer not found.";
  if (!active && (await db.timetableSlot.count({ where: { lecturerId: userId } }))) return "This lecturer still has classes in the timetable. Give them to another lecturer first.";
  await db.user.update({ where: { id: userId }, data: { active } }); return null;
}

/* ---------- LEC-05: CSV import and export ---------- */
export const CSV_COLUMNS = ["name", "email", "phone", "subjects", "languages", "qualifications", "licences", "industryRole", "payModel", "rate", "currency", "maxHoursWeek", "contractStart", "contractEnd"] as const;
const EXPORT_COLUMNS = CSV_COLUMNS.filter((c) => !SENSITIVE.includes(c as "rate"));
export function parseCsv(text: string): string[][] { const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === "," || ch === ";") { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some((c) => c.trim())) rows.push(row); row = []; cell = ""; } else cell += ch; }
  row.push(cell); if (row.some((c) => c.trim())) rows.push(row); return rows; }
/** Validates every row first; nothing is saved if any row is wrong. Existing emails are updated (non-sensitive fields only), new ones created with a temporary password to reset. */
export async function importLecturers(a: Actor, text: string): Promise<{ errors: string[]; created: number; updated: number }> {
  if (!MANAGERS.includes(a.role)) return { errors: ["Not allowed."], created: 0, updated: 0 }; const rows = parseCsv(text.replace(/^﻿/, "")); if (rows.length < 2) return { errors: ["The file has no data rows."], created: 0, updated: 0 };
  const head = rows[0].map((h) => h.trim()); const missing = ["name", "email"].filter((c) => !head.includes(c)); if (missing.length) return { errors: [`Missing column: ${missing.join(", ")}.`], created: 0, updated: 0 };
  const unknown = head.filter((h) => h && !CSV_COLUMNS.includes(h as "name")); if (unknown.length) return { errors: [`Unknown column: ${unknown.join(", ")}.`], created: 0, updated: 0 };
  const errors: string[] = [], items: { email: string; name: string; prof: Record<string, unknown> }[] = [], seen = new Set<string>();
  rows.slice(1, 1001).forEach((r, i) => { const o = Object.fromEntries(head.map((h, j) => [h, (r[j] ?? "").trim()])); const line = i + 2; const email = (o.email ?? "").toLowerCase();
    if (!o.name) errors.push(`Row ${line}: name is empty.`); if (!/^\S+@\S+\.\S+$/.test(email)) errors.push(`Row ${line}: email "${o.email}" is not valid.`); else if (seen.has(email)) errors.push(`Row ${line}: ${email} appears twice.`); seen.add(email);
    const { name, email: _e, ...rest } = o; void _e; const p = cleanProfile(Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== "")) as ProfileInput); if (typeof p === "string") errors.push(`Row ${line}: ${p}`); else items.push({ email, name, prof: p }); });
  if (errors.length) return { errors: errors.slice(0, 30), created: 0, updated: 0 };
  const existing = new Map((await db.user.findMany({ where: { email: { in: items.map((x) => x.email) } }, include: { lecturer: true } })).map((u) => [u.email, u]));
  for (const x of items) { const u = existing.get(x.email); if (u && u.role !== "LECTURER") return { errors: [`${x.email} belongs to a staff account that is not a lecturer.`], created: 0, updated: 0 }; }
  const bcrypt = (await import("bcryptjs")).default; let created = 0, updated = 0;
  for (const x of items) { const u = existing.get(x.email); const plain = Object.fromEntries(Object.entries(x.prof).filter(([k]) => !SENSITIVE.includes(k as "rate")));
    if (u) { await db.user.update({ where: { id: u.id }, data: { name: x.name } }); await db.lecturerProfile.upsert({ where: { userId: u.id }, update: plain as never, create: { userId: u.id, ...x.prof } as never }); updated++; }
    else { await db.user.create({ data: { name: x.name, email: x.email, role: "LECTURER", passwordHash: await bcrypt.hash(crypto.randomUUID(), 10), lecturer: { create: x.prof as never } } }); created++; } }
  return { errors: [], created, updated };
}
export async function exportLecturers() {
  const rows = await db.user.findMany({ where: { role: "LECTURER" }, include: { lecturer: true }, orderBy: { name: "asc" } }); const q = (v: unknown) => `"${String(Array.isArray(v) ? v.join(", ") : v instanceof Date ? v.toISOString().slice(0, 10) : v ?? "").replace(/"/g, '""')}"`;
  return [[...EXPORT_COLUMNS, "active"].join(","), ...rows.map((u) => [u.name, u.email, ...EXPORT_COLUMNS.slice(2).map((c) => (u.lecturer as Record<string, unknown> | null)?.[c]), u.active ? "yes" : "no"].map(q).join(","))].join("\n");
}

/* ---------- LEC-12: workload ---------- */
export async function workload(userId: string) {
  const [p, slots] = await Promise.all([db.lecturerProfile.findUnique({ where: { userId } }), db.timetableSlot.findMany({ where: { lecturerId: userId }, include: { group: true, room: true }, orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }] })]);
  const hours = Math.round((slots.reduce((n, s) => n + (s.endMin - s.startMin), 0) / 60) * 10) / 10; const max = p?.maxHoursWeek ?? 20; const av = (p?.availability ?? {}) as Record<string, string[]>;
  const outside = slots.filter((s) => { const ok = av[String(s.dayOfWeek)]; return Array.isArray(ok) && ok.length > 0 && !ok.some((r) => { const [f, t] = r.split("-").map((x) => { const [h, m] = x.split(":").map(Number); return h * 60 + m; }); return s.startMin >= f && s.endMin <= t; }); });
  return { slots, hours, max, over: hours > max, outside };
}
/** Availability as { "1": ["08:00-12:00", ...], ... }. Each range must be a valid HH:MM-HH:MM. */
export function cleanAvailability(raw: Record<string, string>): Record<string, string[]> | string {
  const out: Record<string, string[]> = {}; for (const d of ["1", "2", "3", "4", "5", "6", "7"]) { const v = (raw[d] ?? "").trim(); if (!v) continue; const ranges = v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    for (const r of ranges) { const m = r.match(/^([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)$/); if (!m || Number(m[1]) * 60 + Number(m[2]) >= Number(m[3]) * 60 + Number(m[4])) return `Write times like 08:00-12:00 (problem: "${r}").`; }
    out[d] = ranges.map((r) => r.replace(/\s/g, "").replace(/^(\d):/, "0$1:").replace(/-(\d):/, "-0$1:")); } return out;
}

/* ---------- LEC-13: lesson reports ---------- */
export const syllabusOf = (modules: unknown) => asModules(modules).flatMap((m) => [m.name, ...((m as { topics?: string[] }).topics ?? []).map((t) => `${m.name}: ${t}`)]);
export async function saveLessonReport(a: Actor, slotId: string, dateISO: string, topic: string, notes?: string, issues?: string): Promise<string | null> {
  const slot = await db.timetableSlot.findUnique({ where: { id: slotId } }); if (!slot) return "Class not found."; if (slot.lecturerId !== a.uid && !MANAGERS.includes(a.role)) return "This is not your class.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return "Bad date."; const date = new Date(dateISO + "T00:00:00Z"); if (+date > +kigaliDate()) return "You can report a class only once it has taken place.";
  if (((date.getUTCDay() + 6) % 7) + 1 !== slot.dayOfWeek) return "This class does not run on that day."; const t = (topic ?? "").trim().slice(0, 200); if (t.length < 2) return "Choose or write the topic covered.";
  const onTime = Date.now() - +date <= 48 * 3600e3; // the class day plus the next day
  await db.lessonReport.upsert({ where: { slotId_date: { slotId, date } }, update: { topic: t, notes: (notes ?? "").trim().slice(0, 1000) || null, issues: (issues ?? "").trim().slice(0, 1000) || null }, create: { slotId, date, lecturerId: slot.lecturerId, topic: t, notes: (notes ?? "").trim().slice(0, 1000) || null, issues: (issues ?? "").trim().slice(0, 1000) || null, onTime } });
  return null;
}
/** Every date a class should have run between two dates (inclusive), for the given weekday. */
export function sessionDates(dayOfWeek: number, from: Date, to: Date): string[] { const out: string[] = []; const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); while (((d.getUTCDay() + 6) % 7) + 1 !== dayOfWeek) d.setUTCDate(d.getUTCDate() + 1); for (; +d <= +to; d.setUTCDate(d.getUTCDate() + 7)) out.push(d.toISOString().slice(0, 10)); return out; }

/* ---------- LEC-14, LEC-15: teaching report and compliance ---------- */
export async function teachingReport(userId: string, from: Date, to: Date) {
  const slots = await db.timetableSlot.findMany({ where: { lecturerId: userId }, include: { group: { include: { programme: true, intake: true } }, lessonReports: { where: { date: { gte: from, lte: to } } } } });
  const assessments = await db.assessment.findMany({ where: { groupId: { in: slots.map((s) => s.groupId) }, createdById: userId } });
  // Expected sessions run from the intake start (or the period start); a session with a lesson report always counts, even before the intake date.
  const rows = slots.flatMap((s) => { const start = s.group.intake.startsOn > from ? s.group.intake.startsOn : from; const dates = new Set(sessionDates(s.dayOfWeek, start, to)); for (const r of s.lessonReports) dates.add(r.date.toISOString().slice(0, 10));
    return [...dates].sort().map((d) => ({ slot: s, date: d, report: s.lessonReports.find((r) => r.date.toISOString().slice(0, 10) === d) ?? null })); });
  const attended = await db.classSession.findMany({ where: { slotId: { in: slots.map((s) => s.id) }, date: { gte: from, lte: to }, records: { some: {} } }, select: { slotId: true, date: true } });
  const withAttendance = new Set(attended.map((x) => x.slotId + x.date.toISOString().slice(0, 10)));
  const syllabus = new Map<string, Set<string>>(); for (const s of slots) { const all = syllabusOf(s.group.programme.modules); if (!syllabus.has(s.group.programmeId)) syllabus.set(s.group.programmeId, new Set(all)); }
  const covered = new Map<string, Set<string>>(); for (const r of rows) if (r.report) { const set = covered.get(r.slot.group.programmeId) ?? new Set(); set.add(r.report.topic); covered.set(r.slot.group.programmeId, set); }
  let sylTotal = 0, sylDone = 0; for (const [pid, all] of syllabus) { sylTotal += all.size; sylDone += [...(covered.get(pid) ?? [])].filter((t) => all.has(t)).length; }
  const reported = rows.filter((r) => r.report).length, onTime = rows.filter((r) => r.report?.onTime).length, hours = rows.filter((r) => r.report).reduce((n, r) => n + (r.slot.endMin - r.slot.startMin) / 60, 0);
  const due = assessments.filter((x) => x.heldOn && +x.heldOn + 14 * 864e5 < Date.now()); const gradedOnTime = due.filter((x) => x.status !== "DRAFT").length;
  return { rows, sessions: rows.length, reported, onTime, attendanceTaken: rows.filter((r) => withAttendance.has(r.slot.id + r.date)).length, hours: Math.round(hours * 10) / 10,
    pct: { reports: rows.length ? Math.round((reported / rows.length) * 100) : 100, onTime: reported ? Math.round((onTime / reported) * 100) : 100, syllabus: sylTotal ? Math.round((sylDone / sylTotal) * 100) : null, grades: due.length ? Math.round((gradedOnTime / due.length) * 100) : 100 } };
}

/* ---------- LEC-16: substitutes ---------- */
export async function askSubstitute(a: Actor, slotId: string, dateISO: string, reasonRaw: string): Promise<string | null> {
  const slot = await db.timetableSlot.findUnique({ where: { id: slotId } }); if (!slot || slot.lecturerId !== a.uid) return "This is not your class."; if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return "Choose the date."; const date = new Date(dateISO + "T00:00:00Z");
  if (+date < +kigaliDate()) return "Choose a date today or later."; if (((date.getUTCDay() + 6) % 7) + 1 !== slot.dayOfWeek) return "This class does not run on that day."; const reason = (reasonRaw ?? "").trim().slice(0, 400); if (reason.length < 5) return "Say why you cannot attend.";
  if (await db.substituteRequest.findFirst({ where: { slotId, date, status: { in: ["PENDING", "APPROVED"] } } })) return "A substitute request already exists for that class."; await db.substituteRequest.create({ data: { slotId, date, lecturerId: a.uid, reason } }); return null;
}
/** Approving names the substitute, who must be an active lecturer free at that time. */
export async function decideSubstitute(a: Actor, id: string, approve: boolean, substituteId?: string, note?: string): Promise<string | null> {
  if (!MANAGERS.includes(a.role)) return "Not allowed."; const r = await db.substituteRequest.findUnique({ where: { id }, include: { slot: true } }); if (!r || r.status !== "PENDING") return "Nothing to decide.";
  if (approve) { const s = substituteId ? await db.user.findUnique({ where: { id: substituteId } }) : null; if (!s || s.role !== "LECTURER" || !s.active || s.id === r.lecturerId) return "Choose another active lecturer as the substitute.";
    const busy = await db.timetableSlot.findFirst({ where: { lecturerId: s.id, dayOfWeek: r.slot.dayOfWeek, startMin: { lt: r.slot.endMin }, endMin: { gt: r.slot.startMin } } }); if (busy) return `${s.name} teaches another class at that time.`; }
  else if (!(note ?? "").trim()) return "Give a reason when you refuse.";
  await db.substituteRequest.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", substituteId: approve ? substituteId : null, decidedBy: a.name, note: (note ?? "").trim().slice(0, 400) || null } }); return null;
}
