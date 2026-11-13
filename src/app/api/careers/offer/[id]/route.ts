import { getSession } from "@/lib/session";
import { MANAGERS } from "@/lib/lecturers";
import { offerLetter } from "@/lib/recruitment";
/** LEC-10: offer letter PDF with verification code. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession(); if (!s || !MANAGERS.includes(s.role)) return new Response("Not allowed", { status: 403 });
  const o = await offerLetter((await params).id); if (!o) return new Response("No offer yet", { status: 404 });
  return new Response(new Uint8Array(o.pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${o.name}"`, "cache-control": "no-store" } });
}
