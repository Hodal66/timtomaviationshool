import { getApplicantEmail } from "@/lib/otp";
import { claimPayment } from "@/lib/finance";
import { limited, clientIp } from "@/lib/ratelimit";
export async function POST(req: Request) {
  const email = await getApplicantEmail(); if (!email) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (limited(`apply-pay:${clientIp(req.headers)}`, 10, 60e3)) return Response.json({ ok: false, error: "Too many requests. Wait a minute and try again." }, { status: 429 });
  const b = await req.json().catch(() => null);
  const err = await claimPayment(email, String(b?.invoiceId ?? ""), String(b?.channel ?? ""), String(b?.reference ?? ""), Number(b?.amount) || 0);
  return Response.json(err ? { ok: false, error: err } : { ok: true }, { status: err ? 400 : 200 });
}
