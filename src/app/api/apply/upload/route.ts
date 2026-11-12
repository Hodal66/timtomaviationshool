import { db } from "@/lib/db";
import { DOC_KINDS, MAX_UPLOAD, UPLOAD_MIME } from "@/lib/apply";

const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "cache-control": "no-store" } });
const SIGS: Record<string, (b: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8, "image/png": (b) => b[0] === 0x89 && b[1] === 0x50,
  "image/webp": (b) => b[8] === 0x57 && b[9] === 0x45, "application/pdf": (b) => b[0] === 0x25 && b[1] === 0x50,
};

/** Upload one document, either for a draft (token) or later for a submitted application (reference + phone or email). */
export async function POST(req: Request) {
  const f = await req.formData().catch(() => null);
  if (!f) return json({ error: "Invalid upload" }, 400);
  const kind = String(f.get("kind") ?? ""), file = f.get("file");
  if (!(DOC_KINDS as readonly string[]).includes(kind)) return json({ error: "Unknown document type." }, 400);
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose a file." }, 400);
  if (file.size > MAX_UPLOAD) return json({ error: "That file is larger than 4 MB. Take a smaller photo or compress the PDF." }, 413);
  if (!UPLOAD_MIME.includes(file.type)) return json({ error: "Upload a JPG, PNG, WebP or PDF file." }, 415);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!SIGS[file.type]?.(bytes)) return json({ error: "That file does not look like a real " + file.type.split("/")[1].toUpperCase() + "." }, 415);

  const token = String(f.get("token") ?? ""), ref = String(f.get("reference") ?? "").trim().toUpperCase(), who = String(f.get("who") ?? "").trim().toLowerCase();
  const data = { kind, filename: file.name.replace(/[^\w.\- ]/g, "_").slice(0, 120), mime: file.type, size: file.size, data: Buffer.from(bytes) };
  if (token) {
    const draft = await db.applicationDraft.findUnique({ where: { token }, include: { _count: { select: { uploads: true } } } });
    if (!draft) return json({ error: "Your draft was not found. Reload the page." }, 404);
    await db.upload.deleteMany({ where: { draftId: draft.id, kind } });
    if (draft._count.uploads > 12) return json({ error: "Too many files." }, 429);
    await db.upload.create({ data: { ...data, draftId: draft.id } });
    return json({ kind, filename: data.filename, size: data.size });
  }
  if (ref && who) {
    const a = await db.applicant.findUnique({ where: { reference: ref } });
    const digits = who.replace(/[^\d+]/g, "");
    if (!a || !((a.email && a.email === who) || (a.phone && digits && a.phone === digits))) return json({ error: "We could not match those details." }, 403);
    await db.$transaction([
      db.upload.deleteMany({ where: { applicantId: a.id, kind } }),
      db.upload.create({ data: { ...data, applicantId: a.id } }),
      db.documentItem.updateMany({ where: { applicantId: a.id, kind, status: { in: ["PENDING", "MISSING", "RECEIVED"] } }, data: { status: "RECEIVED", note: null } }),
      db.applicationEvent.create({ data: { applicantId: a.id, type: "DOC", actorName: "Applicant", message: `${kind}: uploaded by the applicant.` } }),
    ]);
    return json({ kind, filename: data.filename, size: data.size });
  }
  return json({ error: "Missing draft token." }, 400);
}

export async function DELETE(req: Request) {
  const u = new URL(req.url), token = u.searchParams.get("token"), kind = u.searchParams.get("kind");
  if (!token || !kind) return json({ error: "Invalid request" }, 400);
  const d = await db.applicationDraft.findUnique({ where: { token } });
  if (d) await db.upload.deleteMany({ where: { draftId: d.id, kind } });
  return json({ ok: true });
}
