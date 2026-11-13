import { db } from "@/lib/db";
import { myApplication } from "@/lib/me";
const OK = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "text/plain"];
/** STU-07: a student hands in work for an assessment of their class group, until marks are submitted. PDF, Word, image, ZIP or text, up to 4 MB. A new file replaces the old one. */
export async function POST(req: Request) {
  const f = await req.formData().catch(() => null); const a = await myApplication(f?.get("applicantId")); if (!a) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const x = await db.assessment.findUnique({ where: { id: String(f!.get("assessmentId") ?? "") } }); if (!x || x.groupId !== a.classGroupId || !x.acceptsSubmissions) return Response.json({ ok: false, error: "Assessment not found." }, { status: 404 });
  if (x.status !== "DRAFT") return Response.json({ ok: false, error: "Marking has started, so work can no longer be handed in." }, { status: 409 });
  const file = f!.get("file"); if (!(file instanceof File) || !file.size) return Response.json({ ok: false, error: "Choose a file." }, { status: 400 }); if (file.size > 4 * 1024 * 1024) return Response.json({ ok: false, error: "That file is larger than 4 MB." }, { status: 413 }); if (!OK.includes(file.type)) return Response.json({ ok: false, error: "Hand in a PDF, Word, image, ZIP or text file." }, { status: 415 });
  const data = { filename: file.name.replace(/[^\w.\- ]/g, "_").slice(0, 120), mime: file.type, size: file.size, data: new Uint8Array(await file.arrayBuffer()), submittedAt: new Date() };
  await db.submission.upsert({ where: { assessmentId_applicantId: { assessmentId: x.id, applicantId: a.id } }, update: data, create: { ...data, assessmentId: x.id, applicantId: a.id } });
  return Response.json({ ok: true, late: !!x.dueOn && Date.now() > +x.dueOn + 864e5 });
}
