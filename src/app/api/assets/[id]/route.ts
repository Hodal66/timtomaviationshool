import { db } from "@/lib/db";

/** Public programme images uploaded from Admin > Courses. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await db.asset.findUnique({ where: { id: (await params).id } });
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(a.data), { headers: { "content-type": a.mime, "x-content-type-options": "nosniff", "cache-control": "public, max-age=31536000, immutable" } });
}
