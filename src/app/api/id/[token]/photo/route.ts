import { db } from "@/lib/db";
import { readIdToken } from "@/lib/student";
/** The photo on a student ID. Only reachable with the signed ID link. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const id = readIdToken(decodeURIComponent((await params).token)); if (!id) return new Response("Not found", { status: 404 });
  const u = await db.upload.findFirst({ where: { applicantId: id, kind: "Profile photo" } }); if (!u) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(u.data), { headers: { "content-type": u.mime, "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } });
}
