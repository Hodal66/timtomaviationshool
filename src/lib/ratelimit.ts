/**
 * Small fixed-window limiter. State is per server instance (memory), so on serverless hosting it slows
 * a single attacker down but is not a global guarantee; a shared store (Redis/Upstash) is the upgrade path.
 */
const hits = new Map<string, { n: number; reset: number }>();
/** QA only: the whole automated suite shares one address, so apply-flow limits can be scaled up there. Production leaves this at 1. */
const SCALE = Math.max(1, Number(process.env.RATE_LIMIT_SCALE ?? 1) || 1);
export function limited(key: string, max: number, windowMs: number): boolean {
  if (key.startsWith("apply")) max *= SCALE;
  const now = Date.now(); const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k); return false; }
  h.n += 1; return h.n > max;
}
export const clientIp = (h: Headers) => (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";

/** True when the key has already used up its allowance, without counting a new hit. */
export const exhausted = (key: string, max: number) => { const h = hits.get(key); return !!h && h.reset > Date.now() && h.n >= max; };
