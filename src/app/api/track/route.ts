import { record } from "@/lib/track";
const OK = new Set(["PAGE_VIEW", "APPLY_CLICK"]);
const s = (v: unknown, n = 120) => (typeof v === "string" && v ? v.slice(0, n) : null);
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (b && OK.has(b.type)) await record({ type: b.type, path: s(b.path, 200) ?? "/", programmeId: s(b.programmeId, 40), utmSource: s(b.utmSource), utmMedium: s(b.utmMedium), utmCampaign: s(b.utmCampaign), lang: s(b.lang, 8) });
  return new Response(null, { status: 204 });
}
