import { myApplication } from "@/lib/me";
import { updateProfile, createRequest, openTicket, replyTicket, rateTicket } from "@/lib/student";
import { limited, clientIp } from "@/lib/ratelimit";
/** Student self-service actions. Each one is checked against the signed-in student's own record. */
export async function POST(req: Request) {
  if (limited(`apply-student:${clientIp(req.headers)}`, 30, 60e3)) return Response.json({ ok: false, error: "Too many requests. Wait a minute and try again." }, { status: 429 });
  const b = await req.json().catch(() => null); const a = await myApplication(b?.applicantId); if (!a) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const act = String(b.action ?? ""); let err: string | null = "Unknown action.";
  if (act === "profile") err = await updateProfile(a.id, b);
  else if (act === "request") err = await createRequest(a.id, b);
  else if (act === "ticket") err = await openTicket(a.id, b.subject, b.category, b.body, a.fullName);
  else if (act === "reply") err = await replyTicket(String(b.ticketId), b.body, { applicantId: a.id, name: a.fullName });
  else if (act === "rate") err = await rateTicket(String(b.ticketId), a.id, Number(b.rating));
  return Response.json(err ? { ok: false, error: err } : { ok: true }, { status: err ? 400 : 200 });
}
