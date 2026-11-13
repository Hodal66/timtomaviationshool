import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canTeachGroup } from "@/lib/assessment";
/** Staff download of handed-in work: the group's lecturers and academic staff only. Served as a download, never rendered. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession(); if (!s) return new Response("Forbidden", { status: 403 }); const sub = await db.submission.findUnique({ where: { id: (await params).id }, include: { assessment: true } });
  if (!sub || !(await canTeachGroup({ uid: s.uid, name: s.name, role: s.role }, sub.assessment.groupId))) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(sub.data), { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="${sub.filename.replace(/"/g, "")}"`, "x-content-type-options": "nosniff", "cache-control": "private, no-store" } });
}
