import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { redirect } from "next/navigation";
import { label } from "@/lib/format";
export const dynamic = "force-dynamic";

const day = (s?: string, end = false) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T${end ? "23:59:59" : "00:00:00"}Z`) : undefined);
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "-");

export default async function Executive({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const me = await getSession();
  if (!me || !can.reports(me.role)) redirect("/dashboard");
  const sp = await searchParams;
  const from = day(sp.from) ?? new Date(Date.now() - 30 * 864e5), to = day(sp.to, true) ?? new Date();
  const range = { gte: from, lte: to };
  const [views, courseViews, clicks, enquiries, applications, byStatus, byCourse, byBranch, byIntake, paid, pending, events, apps, courses, devices, langs] = await Promise.all([
    db.pageEvent.count({ where: { type: "PAGE_VIEW", createdAt: range } }),
    db.pageEvent.count({ where: { type: "PAGE_VIEW", programmeId: { not: null }, createdAt: range } }),
    db.pageEvent.count({ where: { type: "APPLY_CLICK", createdAt: range } }),
    db.lead.count({ where: { createdAt: range, message: { not: { startsWith: "Application " } } } }),
    db.applicant.count({ where: { createdAt: range } }),
    db.applicant.groupBy({ by: ["status"], where: { createdAt: range }, _count: true }),
    db.applicant.groupBy({ by: ["programmeId"], where: { createdAt: range }, _count: true }),
    db.applicant.groupBy({ by: ["branchId"], where: { createdAt: range }, _count: true }),
    db.applicant.groupBy({ by: ["intakeId"], where: { createdAt: range }, _count: true }),
    db.invoice.aggregate({ _sum: { amountMinor: true }, where: { status: "PAID", paidAt: range } }),
    db.invoice.aggregate({ _sum: { amountMinor: true }, where: { status: "PENDING" } }),
    db.pageEvent.groupBy({ by: ["programmeId", "type"], where: { programmeId: { not: null }, type: { in: ["PAGE_VIEW", "APPLY_CLICK"] }, createdAt: range }, _count: true }),
    db.applicant.groupBy({ by: ["utmSource"], where: { createdAt: range }, _count: true }),
    db.programme.findMany({ select: { id: true, name: true } }),
    db.pageEvent.groupBy({ by: ["device"], where: { type: "PAGE_VIEW", createdAt: range }, _count: true }),
    db.pageEvent.groupBy({ by: ["lang"], where: { type: "PAGE_VIEW", createdAt: range }, _count: true }),
  ]);
  const [branches, intakes] = await Promise.all([db.branch.findMany(), db.intake.findMany()]);
  const n = (s: string) => byStatus.find((x) => x.status === s)?._count ?? 0;
  const cname = (id: string) => courses.find((c) => c.id === id)?.name ?? id;
  const viewsBy = (id: string, t: string) => events.find((e) => e.programmeId === id && e.type === t)?._count ?? 0;
  const popular = byCourse.map((c) => ({ id: c.programmeId, apps: c._count, v: viewsBy(c.programmeId, "PAGE_VIEW"), k: viewsBy(c.programmeId, "APPLY_CLICK") }))
    .concat(courses.filter((c) => !byCourse.some((b) => b.programmeId === c.id) && viewsBy(c.id, "PAGE_VIEW")).map((c) => ({ id: c.id, apps: 0, v: viewsBy(c.id, "PAGE_VIEW"), k: viewsBy(c.id, "APPLY_CLICK") })))
    .sort((a, b) => b.v + b.apps - (a.v + a.apps));
  const qs = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;
  const K = (t: string, v: string | number, sub?: string) => <div className="kpi"><span>{t}</span><b>{v}</b>{sub && <small style={{ color: "var(--muted)" }}>{sub}</small>}</div>;
  return (<><div className="top"><h1>Executive dashboard</h1><p>Only figures from data TAS-One has collected. Website visitors are counted as page views; unique visitors are not tracked.</p></div>
    <form className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
      <label htmlFor="from">From</label><input id="from" type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} /><label htmlFor="to">To</label><input id="to" type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} />
      <button type="submit">Apply</button><a href={`/api/export?what=applications&${qs}`}>Export applications (CSV)</a><a href={`/api/export?what=campaigns&${qs}`}>Export campaigns (CSV)</a></form>
    <div className="kpis">
      {K("Website page views", views)}{K("Course page views", courseViews)}{K("Apply Now clicks", clicks)}{K("New enquiries", enquiries)}{K("New applications", applications, `Click to application: ${pct(applications, clicks)}`)}
      {K("Awaiting review", n("SUBMITTED"))}{K("Admitted", n("ADMITTED"))}{K("Enrolled", n("ENROLLED"))}
      {K("Registration revenue (RWF)", (paid._sum.amountMinor ?? 0).toLocaleString("en-US"), "Verified payments in range")}{K("Outstanding (RWF)", (pending._sum.amountMinor ?? 0).toLocaleString("en-US"), "All unpaid invoices")}</div>
    <div className="panel tbl" style={{ marginBottom: 16 }}><h2>Course popularity</h2><table><thead><tr><th>Course</th><th>Page views</th><th>Apply clicks</th><th>Applications</th><th>View to application</th></tr></thead><tbody>
      {popular.length === 0 && <tr><td colSpan={5}>No data in this period.</td></tr>}{popular.map((p) => <tr key={p.id}><td>{cname(p.id)}</td><td>{p.v}</td><td>{p.k}</td><td>{p.apps}</td><td>{pct(p.apps, p.v)}</td></tr>)}</tbody></table></div>
    <div className="kpis" style={{ alignItems: "start" }}>
      <div className="panel tbl"><h2>Applications by branch</h2><table><tbody>{byBranch.map((b) => <tr key={b.branchId}><td>{branches.find((x) => x.id === b.branchId)?.name}</td><td>{b._count}</td></tr>)}</tbody></table></div>
      <div className="panel tbl"><h2>Applications by intake</h2><table><tbody>{byIntake.map((b) => <tr key={b.intakeId}><td>{intakes.find((x) => x.id === b.intakeId)?.label}</td><td>{b._count}</td></tr>)}</tbody></table></div>
      <div className="panel tbl"><h2>Campaign sources</h2><table><tbody>{apps.map((a) => <tr key={a.utmSource ?? "direct"}><td>{a.utmSource ?? "Direct / none"}</td><td>{a._count}</td></tr>)}</tbody></table></div>
      <div className="panel tbl"><h2>Devices</h2><table><tbody>{devices.map((d) => <tr key={d.device ?? "?"}><td>{d.device ? label(d.device) : "Unknown"}</td><td>{d._count}</td></tr>)}</tbody></table></div>
      <div className="panel tbl"><h2>Visitor language</h2><table><tbody>{langs.map((d) => <tr key={d.lang ?? "?"}><td>{d.lang ?? "Unknown"}</td><td>{d._count}</td></tr>)}</tbody></table></div></div></>);
}
