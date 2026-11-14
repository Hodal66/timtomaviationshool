import { db } from "./db";
import type { Actor } from "./lecturers";

export const AUTHORS = ["ADMIN", "ACADEMIC", "LECTURER"], REVIEWERS = ["ADMIN", "ACADEMIC"];
export const KINDS = ["NOTES", "SLIDES", "VIDEO", "AUDIO", "EXERCISE", "READING", "LINK", "OTHER"] as const;
export const LICENCES = ["School copyright", "Lecturer's own work, shared with the School", "Creative Commons BY 4.0", "Creative Commons BY-NC 4.0", "Third-party, used under licence", "Public domain"] as const;
export const RES_MAX = 4 * 1024 * 1024; export const BIN_DAYS = 30;
const PK = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
/** Allowed types, checked against the file's first bytes. `view` = the browser can show it, so it can be view-only. */
export const RES_TYPES: Record<string, { ok: (b: Uint8Array) => boolean; view: boolean; ext: string }> = {
  "application/pdf": { ok: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, view: true, ext: "pdf" },
  "image/png": { ok: (b) => b[0] === 0x89 && b[1] === 0x50, view: true, ext: "png" }, "image/jpeg": { ok: (b) => b[0] === 0xff && b[1] === 0xd8, view: true, ext: "jpg" },
  "video/mp4": { ok: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70, view: true, ext: "mp4" },
  "audio/mpeg": { ok: (b) => (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0), view: true, ext: "mp3" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ok: PK, view: false, ext: "docx" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ok: PK, view: false, ext: "pptx" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ok: PK, view: false, ext: "xlsx" },
};
export type Src = { file?: { name: string; type: string; bytes: Uint8Array } | null; url?: string | null };
export type Meta = { title?: string; description?: string; programmeId?: string; module?: string; topic?: string; kind?: string; tags?: string; language?: string; visibility?: string; releaseAt?: string; expiresAt?: string; licence?: string; viewOnly?: boolean | string };
const isAuthor = (a: Actor) => AUTHORS.includes(a.role), isReviewer = (a: Actor) => REVIEWERS.includes(a.role);
const dt = (v?: string) => { if (!v) return null; const d = new Date(v.length === 10 ? v + "T00:00:00Z" : v); return isNaN(+d) ? undefined : d; };

/** RES: metadata checks. Returns the clean fields or an error message. */
export async function cleanMeta(m: Meta) {
  const title = (m.title ?? "").trim().slice(0, 160); if (title.length < 3) return "Enter a title.";
  const kind = m.kind || "NOTES"; if (!(KINDS as readonly string[]).includes(kind)) return "Unknown resource type."; const licence = m.licence || LICENCES[0]; if (!(LICENCES as readonly string[]).includes(licence)) return "Choose a licence.";
  const visibility = m.visibility || "STUDENTS"; if (!["STUDENTS", "STAFF"].includes(visibility)) return "Choose who can see it."; const language = m.language || "en"; if (!["en", "fr", "rw", "sw"].includes(language)) return "Unknown language.";
  const releaseAt = dt(m.releaseAt), expiresAt = dt(m.expiresAt); if (releaseAt === undefined || expiresAt === undefined) return "Check the release and expiry dates."; if (releaseAt && expiresAt && +expiresAt <= +releaseAt) return "The expiry must be after the release.";
  const programmeId = m.programmeId || null; if (programmeId && !(await db.programme.findUnique({ where: { id: programmeId }, select: { id: true } }))) return "Programme not found.";
  return { title, description: (m.description ?? "").trim().slice(0, 2000) || null, programmeId, module: (m.module ?? "").trim().slice(0, 120) || null, topic: (m.topic ?? "").trim().slice(0, 120) || null, kind, licence, visibility, language, releaseAt, expiresAt,
    tags: [...new Set((m.tags ?? "").split(/[,;]/).map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 12), viewOnly: m.viewOnly === true || m.viewOnly === "on" || m.viewOnly === "1" };
}
/** Checks a file or a link. Videos larger than 4 MB go in as a link (YouTube, Drive, Vimeo). */
export function cleanSrc(s: Src): string | { filename?: string; mime?: string; size?: number; data?: Uint8Array<ArrayBuffer>; url?: string } {
  if (s.file && s.file.bytes.length) { const t = RES_TYPES[s.file.type]; if (s.file.bytes.length > RES_MAX) return "The file is larger than 4 MB. Compress it or add it as a link."; if (!t) return "Upload PDF, Word, PowerPoint, Excel, PNG, JPG, MP4 or MP3."; if (!t.ok(s.file.bytes)) return "That file does not match its type.";
    return { filename: s.file.name.replace(/[^\w.\- ]/g, "_").slice(0, 120), mime: s.file.type, size: s.file.bytes.length, data: new Uint8Array(s.file.bytes) }; }
  const url = (s.url ?? "").trim(); if (url) { try { const u = new URL(url); if (u.protocol !== "https:") return "Links must start with https://."; } catch { return "That link is not valid."; } return { url: url.slice(0, 500) }; }
  return "Choose a file or enter a link.";
}
const viewOnlyOk = (v: { mime?: string | null; url?: string | null }) => !!v.url || !!(v.mime && RES_TYPES[v.mime]?.view);

/** RES: upload. Lecturers' uploads wait for review; Academic staff uploads are approved at once. */
export async function createResource(a: Actor, m: Meta, s: Src): Promise<string | { id: string }> {
  if (!isAuthor(a)) return "Not allowed."; const meta = await cleanMeta(m); if (typeof meta === "string") return meta; const v = cleanSrc(s); if (typeof v === "string") return v;
  if (meta.viewOnly && !viewOnlyOk(v)) return "View-only works for PDF, images, video, audio and links. Office files must be downloadable.";
  const r = await db.resource.create({ data: { ...meta, ownerId: a.uid, status: isReviewer(a) ? "APPROVED" : "IN_REVIEW", reviewedBy: isReviewer(a) ? a.name : null, versions: { create: { version: 1, ...v, uploadedBy: a.name, note: "First version" } } } }); return { id: r.id };
}
async function editable(a: Actor, id: string) { const r = await db.resource.findUnique({ where: { id } }); if (!r) return "Resource not found."; if (!(isReviewer(a) || (a.role === "LECTURER" && r.ownerId === a.uid))) return "Not allowed."; return r; }
export async function updateResource(a: Actor, id: string, m: Meta): Promise<string | null> {
  const r = await editable(a, id); if (typeof r === "string") return r; if (r.deletedAt) return "Restore it from the recycle bin first."; const meta = await cleanMeta(m); if (typeof meta === "string") return meta;
  if (meta.viewOnly) { const last = await db.resourceVersion.findUnique({ where: { resourceId_version: { resourceId: id, version: r.version } }, select: { mime: true, url: true } }); if (last && !viewOnlyOk(last)) return "View-only works for PDF, images, video, audio and links. Office files must be downloadable."; }
  await db.resource.update({ where: { id }, data: { ...meta, ...(isReviewer(a) ? {} : { status: "IN_REVIEW", reviewNote: null }), updatedAt: new Date() } }); return null;
}
/** RES: a new version keeps the older ones; a lecturer's new version goes back to review. */
export async function addVersion(a: Actor, id: string, s: Src, note?: string): Promise<string | null> {
  const r = await editable(a, id); if (typeof r === "string") return r; if (r.deletedAt) return "Restore it from the recycle bin first."; const v = cleanSrc(s); if (typeof v === "string") return v; if (r.viewOnly && !viewOnlyOk(v)) return "This resource is view-only: upload a PDF, image, video, audio file or link.";
  const n = r.version + 1; await db.$transaction([db.resourceVersion.create({ data: { resourceId: id, version: n, ...v, uploadedBy: a.name, note: (note ?? "").trim().slice(0, 300) || null } }), db.resource.update({ where: { id }, data: { version: n, ...(isReviewer(a) ? {} : { status: "IN_REVIEW", reviewNote: null }), updatedAt: new Date() } })]); return null;
}
export async function reviewResource(a: Actor, id: string, approve: boolean, note?: string): Promise<string | null> {
  if (!isReviewer(a)) return "Only Academic staff review resources."; const r = await db.resource.findUnique({ where: { id } }); if (!r || r.deletedAt) return "Resource not found."; const n = (note ?? "").trim().slice(0, 500); if (!approve && !n) return "Say what must change.";
  await db.resource.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedBy: a.name, reviewNote: n || null, updatedAt: new Date() } }); return null;
}
/** RES: recycle bin. Deleted items stay restorable for 30 days, then purgeBin removes them. */
export async function trashResource(a: Actor, id: string): Promise<string | null> { const r = await editable(a, id); if (typeof r === "string") return r; if (r.deletedAt) return "Already in the recycle bin."; await db.resource.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: a.name } }); return null; }
export async function restoreResource(a: Actor, id: string): Promise<string | null> { const r = await editable(a, id); if (typeof r === "string") return r; if (!r.deletedAt) return "It is not in the recycle bin."; await db.resource.update({ where: { id }, data: { deletedAt: null, deletedBy: null } }); return null; }
export async function purgeResource(a: Actor, id: string): Promise<string | null> { if (!isReviewer(a)) return "Only Academic staff empty the recycle bin."; const r = await db.resource.findUnique({ where: { id } }); if (!r?.deletedAt) return "Move it to the recycle bin first."; await db.resource.delete({ where: { id } }); return null; }
export const purgeBin = (now = new Date()) => db.resource.deleteMany({ where: { deletedAt: { lt: new Date(+now - BIN_DAYS * 864e5) } } });

/** RES: copy every live resource of a module to another programme or module (for example a new intake's course). Copies keep their review state. */
export async function copyModule(a: Actor, from: { programmeId: string; module: string }, to: { programmeId: string; module: string }): Promise<string | { copied: number }> {
  if (!isReviewer(a)) return "Only Academic staff copy modules."; if (!from.programmeId || !to.programmeId || !from.module.trim() || !to.module.trim()) return "Choose the source and the target module."; if (from.programmeId === to.programmeId && from.module.trim() === to.module.trim()) return "Source and target are the same.";
  const src = await db.resource.findMany({ where: { programmeId: from.programmeId, module: from.module.trim(), deletedAt: null }, include: { versions: true } }); if (!src.length) return "That module has no resources.";
  for (const r of src) { const last = r.versions.find((v) => v.version === r.version)!; const { id: _i, createdAt: _c, updatedAt: _u, versions: _v, programmeId: _p, module: _m, views: _w, downloads: _d, version: _n, ...rest } = r; void _i; void _c; void _u; void _v; void _p; void _m; void _w; void _d; void _n;
    await db.resource.create({ data: { ...rest, programmeId: to.programmeId, module: to.module.trim(), version: 1, versions: { create: { version: 1, filename: last.filename, mime: last.mime, size: last.size, data: last.data, url: last.url, uploadedBy: a.name, note: "Copied from another module" } } } }); }
  return { copied: src.length };
}
/** What a student may see right now. Items tied to a class group (recordings) are only for that group. */
export const studentWhere = (programmeId: string, now = new Date(), groupId: string | null = null) => ({ programmeId, status: "APPROVED", visibility: "STUDENTS", deletedAt: null, AND: [{ OR: [{ releaseAt: null }, { releaseAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: [{ groupId: null }, ...(groupId ? [{ groupId }] : [])] }] });
/** Staff can open everything that is not someone else's unapproved draft; lecturers see their own plus approved items. */
export const staffCanSee = (a: Actor, r: { ownerId: string; status: string }) => isReviewer(a) || (isAuthor(a) && (r.ownerId === a.uid || r.status === "APPROVED"));
/** The programmes (and class groups) an applicant is enrolled in, used to open resources. */
export async function studentScopes(email: string) { return db.applicant.findMany({ where: { email, status: "ENROLLED" }, select: { programmeId: true, classGroupId: true } }); }
export async function studentProgrammes(email: string) { return (await studentScopes(email)).map((x) => x.programmeId); }
export async function studentResources(email: string, now = new Date()) {
  const sc = await studentScopes(email); if (!sc.length) return [];
  return db.resource.findMany({ where: { OR: sc.map((p) => studentWhere(p.programmeId, now, p.classGroupId)) }, select: { id: true, programmeId: true, title: true, description: true, module: true, topic: true, kind: true, licence: true, viewOnly: true, version: true, updatedAt: true, programme: { select: { name: true } }, versions: { select: { version: true, mime: true, url: true, size: true, filename: true } } }, orderBy: [{ module: "asc" }, { title: "asc" }] });
}
