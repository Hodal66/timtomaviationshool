import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
const q = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s; };
/** LEC-25: claims report as CSV (formula-safe). */
export async function GET(req: Request) {
  const s = await getSession(); if (!s || !["ADMIN", "ACADEMIC", "BRANCH_MANAGER", "FINANCE"].includes(s.role)) return new Response("Not allowed", { status: 403 });
  const p = new URL(req.url).searchParams.get("period"); const rows = await db.paymentClaim.findMany({ where: p && /^\d{4}-\d{2}$/.test(p) ? { period: p } : {}, include: { lecturer: { select: { name: true, email: true } } }, orderBy: [{ period: "desc" }] });
  const out = [["period", "lecturer", "email", "payModel", "units", "rate", "currency", "amount", "status", "paidRef", "paidAt"], ...rows.map((r) => [r.period, r.lecturer.name, r.lecturer.email, r.payModel, r.units, r.rate, r.currency, r.amount, r.status, r.paidRef ?? "", r.paidAt?.toISOString().slice(0, 10) ?? ""])].map((r) => r.map(q).join(",")).join("\n");
  return new Response("﻿" + out, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="pay-claims${p ? "-" + p : ""}.csv"` } });
}
