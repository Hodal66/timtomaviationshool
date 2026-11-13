import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { MANAGERS } from "@/lib/lecturers";
/** Staff-only CV download; never cached and sent as an attachment. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession(); if (!s || !MANAGERS.includes(s.role)) return new Response("Not allowed", { status: 403 });
  const j = await db.jobApplication.findUnique({ where: { id: (await params).id }, select: { cv: true, cvMime: true, cvName: true } }); if (!j) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(j.cv), { headers: { "content-type": j.cvMime, "content-disposition": `attachment; filename="${j.cvName.replace(/"/g, "")}"`, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
