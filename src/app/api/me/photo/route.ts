import { db } from "@/lib/db";
import { myApplication } from "@/lib/me";
const SIG: Record<string, (b: Uint8Array) => boolean> = { "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8, "image/png": (b) => b[0] === 0x89 && b[1] === 0x50, "image/webp": (b) => b[8] === 0x57 && b[9] === 0x45 };
/** STU-02: the student's own photo, shown on the digital ID card. JPG, PNG or WebP up to 2 MB. */
export async function POST(req: Request) {
  const f = await req.formData().catch(() => null); const a = await myApplication(f?.get("applicantId")); if (!a) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const file = f!.get("file"); if (!(file instanceof File) || !file.size) return Response.json({ ok: false, error: "Choose a photo." }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return Response.json({ ok: false, error: "That photo is larger than 2 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer()); if (!SIG[file.type]?.(bytes)) return Response.json({ ok: false, error: "Upload a JPG, PNG or WebP photo." }, { status: 415 });
  await db.$transaction([db.upload.deleteMany({ where: { applicantId: a.id, kind: "Profile photo" } }), db.upload.create({ data: { applicantId: a.id, kind: "Profile photo", filename: "photo." + file.type.split("/")[1], mime: file.type, size: file.size, data: Buffer.from(bytes) } })]);
  return Response.json({ ok: true });
}
