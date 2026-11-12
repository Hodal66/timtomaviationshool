import { getApplicantEmail, otpRequired } from "@/lib/otp";
import { limited, clientIp } from "@/lib/ratelimit";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { createApplication } from "@/lib/application";
import type { ApplyData } from "@/lib/apply";

export async function POST(req: Request) {
  if (limited(`apply-submit:${clientIp(req.headers)}`, 10, 60e3)) return Response.json({ ok: false, error: "Too many requests. Wait a minute and try again." }, { status: 429, headers: { "retry-after": "60" } });
  const verifiedEmail = await getApplicantEmail();
  if (!verifiedEmail && otpRequired()) return Response.json({ ok: false, needVerify: true, error: "Please verify your email address first." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const token = typeof b?.token === "string" ? b.token : "";
  const draft = token ? await db.applicationDraft.findUnique({ where: { token } }) : null;
  if (!draft) return Response.json({ ok: false, error: "Your draft was not found. Reload the page and try again." }, { status: 404 });
  const lang = ((await headers()).get("accept-language") ?? "").slice(0, 2) || null;
  const res = await createApplication(draft.data as ApplyData, { draftId: draft.id, cookieUtm: (await cookies()).get("tas_utm")?.value, lang, verifiedEmail: verifiedEmail ?? undefined });
  return Response.json(res, { headers: { "cache-control": "no-store" } }); // business errors are normal answers, not HTTP failures
}
