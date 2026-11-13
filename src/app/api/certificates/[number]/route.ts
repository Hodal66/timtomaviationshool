import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { buildCertificate } from "@/lib/certificates";
/** Staff copy of a certificate PDF. Students download their own from their dashboard. */
export async function GET(_: Request, { params }: { params: Promise<{ number: string }> }) {
  const s = await getSession(); if (!s || !can.reports(s.role)) return new Response("Forbidden", { status: 403 });
  const c = await db.certificate.findUnique({ where: { number: decodeURIComponent((await params).number) }, include: { holder: true, programme: true } }); if (!c) return new Response("Not found", { status: 404 }); if (c.status !== "VALID") return new Response("This certificate is revoked.", { status: 409 });
  return new Response(Buffer.from(await buildCertificate({ number: c.number, kind: c.kind, holder: c.holder.fullName, programme: c.programme.name, issuedOn: c.issuedOn, finalMark: c.finalMark, replacesNumber: c.replacesNumber })), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="Certificate-${c.number}.pdf"`, "cache-control": "private, no-store" } });
}
