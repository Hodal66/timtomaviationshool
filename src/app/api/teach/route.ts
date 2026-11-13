import { getSession } from "@/lib/session";
import { saveLessonReport, askSubstitute, updateLecturer, cleanAvailability } from "@/lib/lecturers";
import { db } from "@/lib/db";
/** Lecturer self-service actions (LEC-06, LEC-13, LEC-16). Repeating a lesson report is safe, so the offline queue can resend. */
export async function POST(req: Request) {
  const s = await getSession(); if (!s) return Response.json({ ok: false, error: "Sign in again." }, { status: 401 }); const a = { uid: s.uid, name: s.name, role: s.role };
  const b = await req.json().catch(() => null); const act = String(b?.action ?? ""); let err: string | null = "Unknown action.";
  if (act === "report") err = await saveLessonReport(a, String(b.slotId), String(b.date), String(b.topic ?? ""), b.notes, b.issues);
  else if (act === "substitute") err = await askSubstitute(a, String(b.slotId), String(b.date), String(b.reason ?? ""));
  else if (act === "availability") { if (s.role !== "LECTURER") err = "Only lecturers set their own availability."; else { const av = cleanAvailability(b.days ?? {}); if (typeof av === "string") err = av; else { await db.lecturerProfile.upsert({ where: { userId: s.uid }, update: { availability: av }, create: { userId: s.uid, availability: av } }); err = null; } } }
  else if (act === "profile") { const r = await updateLecturer(a, s.uid, b.fields ?? {}); err = typeof r === "string" ? r : null; if (!err && typeof r !== "string" && r.pending) return Response.json({ ok: true, pending: true }); }
  return Response.json(err ? { ok: false, error: err } : { ok: true }, { status: err ? 400 : 200 });
}
