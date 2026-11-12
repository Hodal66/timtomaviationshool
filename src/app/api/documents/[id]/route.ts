import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";

/** Staff-only. Applicant documents are never public. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || !can.admissions(s.role)) return new Response("Forbidden", { status: 403 });
  const u = await db.upload.findUnique({ where: { id: (await params).id } });
  if (!u) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(u.data), { headers: { "content-type": u.mime, "content-disposition": `inline; filename="${u.filename}"`, "x-content-type-options": "nosniff", "content-security-policy": "sandbox", "cache-control": "private, no-store" } });
}
