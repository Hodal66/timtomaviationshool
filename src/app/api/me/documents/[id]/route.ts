import { db } from "@/lib/db";
import { getApplicantEmail } from "@/lib/otp";

/** An applicant can download only the files attached to their own applications (matched by verified email). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getApplicantEmail(); if (!email) return new Response("Forbidden", { status: 403 });
  const u = await db.upload.findUnique({ where: { id: (await params).id }, include: { applicant: { select: { email: true } } } });
  if (!u || !u.applicant || u.applicant.email !== email) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(u.data), { headers: { "content-type": u.mime, "content-disposition": `attachment; filename="${u.filename.replace(/"/g, "")}"`, "x-content-type-options": "nosniff", "cache-control": "private, no-store" } });
}
