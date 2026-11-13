import { db } from "./db";
import { notifyApplicant, type Msg } from "./notify";
import { SITE } from "./site";

/* ---------- ASM-01: grading schemes ---------- */
export type Scheme = { components: { name: string; weight: number }[]; passMark: number };
export const DEFAULT_SCHEME: Scheme = { components: [{ name: "Continuous assessment", weight: 30 }, { name: "Weekly Friday assessments", weight: 20 }, { name: "Final exam", weight: 50 }], passMark: 50 };
/** Reads "Name: weight" lines. Weights must be positive and add up to 100; the pass mark is between 1 and 100. */
export function parseScheme(text: string, passMark: number): Scheme | string {
  const components = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(.+?)\s*[:=]\s*(\d+(?:\.\d+)?)\s*%?$/); return m ? { name: m[1].trim().slice(0, 60), weight: Number(m[2]) } : null; });
  if (!components.length || components.some((c) => !c)) return 'Write one part per line as "Name: weight", for example "Final exam: 50".';
  const c = components as Scheme["components"]; if (new Set(c.map((x) => x.name.toLowerCase())).size !== c.length) return "Each part needs a different name.";
  if (c.some((x) => x.weight <= 0)) return "Every weight must be above zero."; if (Math.abs(c.reduce((n, x) => n + x.weight, 0) - 100) > 0.01) return "The weights must add up to 100.";
  if (!(passMark >= 1 && passMark <= 100)) return "The pass mark must be between 1 and 100."; return { components: c, passMark };
}
export const schemeOf = (raw: unknown): Scheme => { const s = raw as Scheme | null; return s && Array.isArray(s.components) && s.components.length && typeof s.passMark === "number" ? s : DEFAULT_SCHEME; };

export type Mark = { component: string; maxScore: number; score: number | null };
export type Result = { parts: { name: string; weight: number; pct: number | null; count: number }[]; overall: number | null; complete: boolean; passed: boolean | null };
/** A part's mark is the average percentage of its published assessments. The overall mark needs every part of the scheme; until then it is provisional. */
export function computeResult(scheme: Scheme, marks: Mark[]): Result {
  const parts = scheme.components.map((c) => { const mine = marks.filter((m) => m.component === c.name && m.score !== null && m.maxScore > 0); return { name: c.name, weight: c.weight, count: mine.length, pct: mine.length ? Math.round((mine.reduce((n, m) => n + (m.score! / m.maxScore) * 100, 0) / mine.length) * 10) / 10 : null }; });
  const have = parts.filter((p) => p.pct !== null); const w = have.reduce((n, p) => n + p.weight, 0); const overall = w ? Math.round((have.reduce((n, p) => n + p.pct! * p.weight, 0) / w) * 10) / 10 : null; const complete = have.length === parts.length;
  return { parts, overall, complete, passed: complete && overall !== null ? overall >= scheme.passMark : null };
}

/* ---------- ASM-02: assessments and grade entry with approval ---------- */
export type Actor = { uid: string; name: string; role: string };
const moderator = (a: Actor) => a.role === "ADMIN" || a.role === "ACADEMIC";
/** Lecturers work only on groups they teach; academic staff and administrators on all. */
export async function canTeachGroup(a: Actor, groupId: string) { if (moderator(a)) return true; if (a.role !== "LECTURER") return false; return !!(await db.timetableSlot.findFirst({ where: { groupId, lecturerId: a.uid }, select: { id: true } })); }

export async function createAssessment(a: Actor, d: { groupId: string; title: string; component: string; maxScore: number; heldOn?: string; dueOn?: string; instructions?: string; acceptsSubmissions?: boolean }): Promise<string | { id: string }> {
  if (!(await canTeachGroup(a, d.groupId))) return "You do not teach this class group."; const g = await db.classGroup.findUnique({ where: { id: d.groupId }, include: { programme: true } }); if (!g) return "Class group not found.";
  const title = (d.title ?? "").trim().slice(0, 120); if (title.length < 2) return "Give the assessment a title."; if (!schemeOf(g.programme.gradingScheme).components.some((c) => c.name === d.component)) return "Choose a part of the grading scheme."; if (!(d.maxScore > 0 && d.maxScore <= 1000)) return "The maximum score must be between 1 and 1000.";
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00Z") : null);
  const x = await db.assessment.create({ data: { groupId: d.groupId, title, component: d.component, maxScore: d.maxScore, heldOn: date(d.heldOn), dueOn: date(d.dueOn), instructions: (d.instructions ?? "").trim().slice(0, 2000) || null, acceptsSubmissions: !!d.acceptsSubmissions, createdBy: a.name, createdById: a.uid } }); return { id: x.id };
}
export type GradeInput = { applicantId: string; score: string | number | null; feedback?: string };
/** Saves marks while the assessment is a draft. An empty score removes the mark. Scores outside 0..max are refused and nothing is saved. */
export async function saveGrades(a: Actor, assessmentId: string, rows: GradeInput[]): Promise<string | { saved: number }> {
  const x = await db.assessment.findUnique({ where: { id: assessmentId } }); if (!x) return "Assessment not found."; if (!(await canTeachGroup(a, x.groupId))) return "You do not teach this class group.";
  if (x.status !== "DRAFT") return "Marks can only be changed while the assessment is a draft. After publication, changes go through an appeal.";
  const ids = new Set((await db.applicant.findMany({ where: { classGroupId: x.groupId, status: "ENROLLED" }, select: { id: true } })).map((s) => s.id)); const clean: { applicantId: string; score: number | null; feedback: string | null }[] = [];
  for (const r of rows.slice(0, 500)) { if (!ids.has(r.applicantId)) continue; const raw = r.score === null || r.score === "" ? null : Number(r.score); if (raw !== null && (!Number.isFinite(raw) || raw < 0 || raw > x.maxScore)) return `Scores must be between 0 and ${x.maxScore}.`; clean.push({ applicantId: r.applicantId, score: raw, feedback: (r.feedback ?? "").trim().slice(0, 600) || null }); }
  await db.$transaction(clean.map((r) => r.score === null ? db.grade.deleteMany({ where: { assessmentId, applicantId: r.applicantId } }) : db.grade.upsert({ where: { assessmentId_applicantId: { assessmentId, applicantId: r.applicantId } }, update: { score: r.score, feedback: r.feedback, updatedBy: a.name, updatedAt: new Date() }, create: { assessmentId, applicantId: r.applicantId, score: r.score, feedback: r.feedback, updatedBy: a.name } })));
  return { saved: clean.filter((r) => r.score !== null).length };
}
export type Step = "submit" | "return" | "approve" | "publish";
/** DRAFT -> SUBMITTED (lecturer) -> APPROVED (moderator, not the person who entered the marks) -> PUBLISHED (moderator). "return" sends it back to draft with a note. */
export async function moveAssessment(a: Actor, assessmentId: string, step: Step, note?: string): Promise<string | null> {
  const x = await db.assessment.findUnique({ where: { id: assessmentId }, include: { _count: { select: { grades: true } }, group: { include: { programme: true } } } }); if (!x) return "Assessment not found.";
  if (step === "submit") { if (!(await canTeachGroup(a, x.groupId))) return "You do not teach this class group."; if (x.status !== "DRAFT") return "Only a draft can be submitted."; if (!x._count.grades) return "Enter at least one mark before submitting.";
    await db.assessment.update({ where: { id: x.id }, data: { status: "SUBMITTED", submittedBy: a.name, reviewNote: null } }); return null; }
  if (!moderator(a)) return "Only academic staff can approve or publish marks.";
  if (step === "return") { if (!["SUBMITTED", "APPROVED"].includes(x.status)) return "Only submitted or approved marks can be returned."; const n = (note ?? "").trim().slice(0, 400); if (!n) return "Say what needs to be corrected."; await db.assessment.update({ where: { id: x.id }, data: { status: "DRAFT", reviewNote: n, approvedBy: null } }); return null; }
  if (step === "approve") { if (x.status !== "SUBMITTED") return "Only submitted marks can be approved."; if (x.createdById === a.uid && a.role !== "ADMIN") return "Marks must be approved by someone other than the person who entered them."; await db.assessment.update({ where: { id: x.id }, data: { status: "APPROVED", approvedBy: a.name } }); return null; }
  if (x.status !== "APPROVED") return "Marks must be approved before they are published.";
  await db.assessment.update({ where: { id: x.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  const graded = await db.grade.findMany({ where: { assessmentId: x.id }, select: { applicantId: true } });
  for (const g of graded) await notifyApplicant(g.applicantId, (s): Msg => ({ template: "result_published", subject: `Result published: ${x.title}`, text: `Hello ${s.fullName.split(" ")[0]},\n\nYour result for "${x.title}" (${x.group.programme.name}) is now on your dashboard.\n${SITE.url}/me\n\n${SITE.name}` }));
  return null;
}

/* ---------- STU-07 / ASM-05: appeals ---------- */
export async function lodgeAppeal(applicantId: string, gradeId: string, reasonRaw: string): Promise<string | null> {
  const g = await db.grade.findUnique({ where: { id: gradeId }, include: { assessment: true, appeals: true } }); if (!g || g.applicantId !== applicantId || g.assessment.status !== "PUBLISHED") return "Result not found.";
  const reason = (reasonRaw ?? "").trim().slice(0, 800); if (reason.length < 10) return "Explain your appeal in at least a sentence."; if (g.appeals.length) return "You have already appealed this result. Each result can be appealed once.";
  if (g.assessment.publishedAt && Date.now() - +g.assessment.publishedAt > 14 * 864e5) return "Appeals close 14 days after a result is published.";
  await db.appeal.create({ data: { gradeId, applicantId, reason, oldScore: g.score } }); return null;
}
/** Upholding an appeal sets the new score (the only way a published mark changes) and records who decided and why. */
export async function decideAppeal(a: Actor, appealId: string, uphold: boolean, newScoreRaw: string | number | null, noteRaw: string): Promise<string | null> {
  if (!moderator(a)) return "Only academic staff can decide appeals."; const ap = await db.appeal.findUnique({ where: { id: appealId }, include: { grade: { include: { assessment: true } } } }); if (!ap) return "Appeal not found."; if (ap.status !== "PENDING") return "This appeal was already decided.";
  const note = (noteRaw ?? "").trim().slice(0, 400); if (!note) return "Write the reason for the decision."; const ns = Number(newScoreRaw);
  if (uphold && (newScoreRaw === null || newScoreRaw === "" || !Number.isFinite(ns) || ns < 0 || ns > ap.grade.assessment.maxScore)) return `Enter the corrected score, between 0 and ${ap.grade.assessment.maxScore}.`;
  await db.$transaction([db.appeal.update({ where: { id: appealId }, data: { status: uphold ? "UPHELD" : "REJECTED", newScore: uphold ? ns : null, note, decidedBy: a.name, decidedAt: new Date() } }), ...(uphold ? [db.grade.update({ where: { id: ap.gradeId }, data: { score: ns, updatedBy: `${a.name} (appeal)`, updatedAt: new Date() } })] : []),
    db.applicationEvent.create({ data: { applicantId: ap.applicantId, type: "SYSTEM", actorName: a.name, message: `Appeal on "${ap.grade.assessment.title}" ${uphold ? `upheld: score changed from ${ap.oldScore} to ${ns}` : "not upheld"}. ${note}` } })]);
  await notifyApplicant(ap.applicantId, (s): Msg => ({ template: "appeal_decided", subject: `Your appeal: ${ap.grade.assessment.title}`, text: `Hello ${s.fullName.split(" ")[0]},\n\nYour appeal on "${ap.grade.assessment.title}" was ${uphold ? `upheld. Your score is now ${ns} out of ${ap.grade.assessment.maxScore}` : "not upheld"}.\n${note}\n${SITE.url}/me\n\n${SITE.name}` }));
  return null;
}

/* ---------- ASM-03: a student's results ---------- */
export async function resultsFor(applicantId: string) {
  const a = await db.applicant.findUnique({ where: { id: applicantId }, include: { programme: true } }); if (!a?.classGroupId) return null; const scheme = schemeOf(a.programme.gradingScheme);
  const list = await db.assessment.findMany({ where: { groupId: a.classGroupId, status: "PUBLISHED" }, orderBy: [{ heldOn: "asc" }, { createdAt: "asc" }], include: { grades: { where: { applicantId }, include: { appeals: true } } } });
  const rows = list.map((x) => ({ id: x.id, title: x.title, component: x.component, maxScore: x.maxScore, heldOn: x.heldOn, grade: x.grades[0] ?? null }));
  const result = computeResult(scheme, rows.map((r) => ({ component: r.component, maxScore: r.maxScore, score: r.grade?.score ?? null })));
  return { scheme, rows, result, parts_text: result.parts.map((p) => `${p.name} (${p.weight}%): ${p.pct === null ? "no result yet" : p.pct + "%"}`).join(". ") + "." };
}
