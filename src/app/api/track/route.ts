import { limited, clientIp } from "@/lib/ratelimit";
import { record } from "@/lib/track";
const OK = new Set(["PAGE_VIEW", "APPLY_CLICK"]);
const s = (v: unknown, n = 120) => (typeof v === "string" && v ? v.slice(0, n) : null);
export async function POST(req: Request) {
  if (limited(`track:${clientIp(req.headers)}`, 60, 60e3)) return Response.json({ ok: false, error: "Too many requests. Wait a minute and try again." }, { status: 429, headers: { "retry-after": "60" } });
  const b = await req.json().catch(() => null);
  if (b && OK.has(b.type)) await record({ type: b.type, path: s(b.path, 200) ?? "/", programmeId: s(b.programmeId, 40), utmSource: s(b.utmSource), utmMedium: s(b.utmMedium), utmCampaign: s(b.utmCampaign), lang: s(b.lang, 8) });
  return new Response(null, { status: 204 });
}
