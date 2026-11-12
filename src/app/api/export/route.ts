import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";

const esc = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; }; // neutralise spreadsheet formulas
const d = (s: string | null, end = false) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T${end ? "23:59:59" : "00:00:00"}Z`) : undefined);

export async function GET(req: Request) {
  const me = await getSession();
  if (!me || !can.reports(me.role)) return new Response("Forbidden", { status: 403 });
  const u = new URL(req.url), range = { gte: d(u.searchParams.get("from")), lte: d(u.searchParams.get("to"), true) };
  let rows: string[][];
  if (u.searchParams.get("what") === "campaigns") {
    const g = await db.applicant.groupBy({ by: ["utmSource", "utmMedium", "utmCampaign"], where: { createdAt: range }, _count: true });
    rows = [["source", "medium", "campaign", "applications"], ...g.map((x) => [x.utmSource ?? "", x.utmMedium ?? "", x.utmCampaign ?? "", String(x._count)])];
  } else {
    const a = await db.applicant.findMany({ where: { createdAt: range }, include: { programme: true, branch: true, intake: true }, orderBy: { createdAt: "asc" } });
    rows = [["reference", "name", "course", "intake", "branch", "session", "status", "source", "created"],
      ...a.map((x) => [x.reference ?? "", x.fullName, x.programme.name, x.intake.label, x.branch.name, x.session, x.status, x.leadSource ?? x.source, x.createdAt.toISOString()])];
  }
  return new Response(rows.map((r) => r.map(esc).join(",")).join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="tas-one-export.csv"' } });
}
