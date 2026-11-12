import { requestOtp } from "@/lib/otp";
import { getLang } from "@/lib/i18n/server";
import { clientIp } from "@/lib/ratelimit";
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const r = await requestOtp(b?.email, await getLang(), clientIp(req.headers));
  return Response.json(r.ok ? { ok: true } : { ok: false, error: r.error }, { status: r.ok ? 200 : r.status, headers: { "cache-control": "no-store" } });
}
