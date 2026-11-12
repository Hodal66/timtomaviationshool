import { headers } from "next/headers";
import { db } from "./db";

const BOT = /bot|crawl|spider|preview|headless|monitor/i;
export const deviceOf = (ua: string) => (/ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop");

export async function record(e: { type: string; path: string; programmeId?: string | null; utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null; lang?: string | null }) {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  if (BOT.test(ua)) return;
  const lang = (e.lang ?? h.get("accept-language") ?? "").slice(0, 2).toLowerCase() || null;
  try {
    await db.pageEvent.create({ data: { ...e, programmeId: e.programmeId ?? null, lang, device: deviceOf(ua) } });
  } catch { /* analytics must never break a page */ }
}

export function readUtm(raw?: string) {
  if (!raw) return null;
  try { const v = JSON.parse(raw.startsWith("%") ? decodeURIComponent(raw) : raw); return { utmSource: v.utmSource ?? null, utmMedium: v.utmMedium ?? null, utmCampaign: v.utmCampaign ?? null } as { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null }; } catch { return null; }
}
