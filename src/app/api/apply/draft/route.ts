import { limited, clientIp } from "@/lib/ratelimit";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { ApplyData } from "@/lib/apply";

const FIELDS = ["course", "branch", "session", "start", "fullName", "phone", "email", "dob", "guardianName", "guardianPhone", "educationLevel", "institution", "completionYear"] as const;
const clean = (raw: unknown): ApplyData => {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") for (const k of FIELDS) { const v = (raw as Record<string, unknown>)[k]; if (typeof v === "string") out[k] = v.slice(0, 200); }
  return out as ApplyData;
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "cache-control": "no-store" } });

/** Create or update a draft. The random token is the only key, so applicants can continue on any device from their link. */
export async function POST(req: Request) {
  if (limited(`apply-draft:${clientIp(req.headers)}`, 120, 60e3)) return Response.json({ ok: false, error: "Too many requests. Wait a minute and try again." }, { status: 429, headers: { "retry-after": "60" } });
  const b = await req.json().catch(() => null);
  if (!b) return json({ error: "Invalid request" }, 400);
  const data = clean(b.data), step = Number.isInteger(b.step) ? Math.max(0, Math.min(6, b.step)) : 0;
  if (typeof b.token === "string" && b.token) {
    const row = await db.applicationDraft.updateMany({ where: { token: b.token }, data: { data, step } });
    if (row.count) return json({ token: b.token });
  }
  const token = randomBytes(18).toString("base64url");
  await db.applicationDraft.create({ data: { token, data, step } });
  // Housekeeping: drafts untouched for 30 days are removed with their uploads.
  void db.applicationDraft.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - 30 * 864e5) } } }).catch(() => {});
  return json({ token });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return json({ error: "Missing token" }, 400);
  const d = await db.applicationDraft.findUnique({ where: { token }, include: { uploads: { select: { kind: true, filename: true, size: true } } } });
  if (!d) return json({ error: "Not found" }, 404);
  return json({ data: d.data, step: d.step, uploads: d.uploads });
}
