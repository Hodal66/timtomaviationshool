import { verifyOtp, createApplicantSession, normEmail } from "@/lib/otp";
import { getLang } from "@/lib/i18n/server";
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const r = await verifyOtp(b?.email, b?.code, await getLang());
  if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: r.status, headers: { "cache-control": "no-store" } });
  await createApplicantSession(normEmail(b.email));
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
