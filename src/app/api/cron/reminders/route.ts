import { sendDueReminders } from "@/lib/finance";
/** Daily job (see vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET"; without a configured secret the job refuses to run. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET; if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Forbidden", { status: 403 });
  return Response.json({ ok: true, reminded: await sendDueReminders() });
}
