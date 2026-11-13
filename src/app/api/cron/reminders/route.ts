import { sendDueReminders } from "@/lib/finance";
import { purgeBin } from "@/lib/resources";
/** Daily job (see vercel.json): payment reminders and emptying the resources recycle bin after 30 days. Vercel sends "Authorization: Bearer $CRON_SECRET"; without a configured secret the job refuses to run. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET; if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Forbidden", { status: 403 });
  return Response.json({ ok: true, reminded: await sendDueReminders(), purgedResources: (await purgeBin()).count });
}
