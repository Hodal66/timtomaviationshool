import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { createApplication } from "@/lib/application";
import type { ApplyData } from "@/lib/apply";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const token = typeof b?.token === "string" ? b.token : "";
  const draft = token ? await db.applicationDraft.findUnique({ where: { token } }) : null;
  if (!draft) return Response.json({ ok: false, error: "Your draft was not found. Reload the page and try again." }, { status: 404 });
  const lang = ((await headers()).get("accept-language") ?? "").slice(0, 2) || null;
  const res = await createApplication(draft.data as ApplyData, { draftId: draft.id, cookieUtm: (await cookies()).get("tas_utm")?.value, lang });
  return Response.json(res, { headers: { "cache-control": "no-store" } }); // business errors are normal answers, not HTTP failures
}
