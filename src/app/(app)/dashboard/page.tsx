import { db } from "@/lib/db";
import { label } from "@/lib/format";
import { ENQUIRY } from "@/lib/leads";
import { emailConfigured } from "@/lib/notify";
export const dynamic = "force-dynamic";

/** Staff home. Every number links to the screen where the work is done, and comes from the same tables the website writes to. */
export default async function Dashboard() {
  const since = new Date(Date.now() - 864e5);
  const [newApps, toVerify, unpaid, enquiries, admitted, today, recent, recentEnq, courses, waQueue] = await Promise.all([
    db.applicant.count({ where: { status: "SUBMITTED" } }),
    db.applicant.count({ where: { status: "SUBMITTED", documents: { some: { status: "RECEIVED" } } } }),
    db.invoice.aggregate({ where: { status: "PENDING" }, _count: true, _sum: { amountMinor: true } }),
    db.lead.count({ where: { status: "NEW", ...ENQUIRY } }),
    db.applicant.count({ where: { status: "ADMITTED" } }),
    db.applicant.count({ where: { createdAt: { gte: since } } }),
    db.applicant.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { programme: true, branch: true, intake: true } }),
    db.lead.findMany({ where: ENQUIRY, orderBy: { createdAt: "desc" }, take: 5 }),
    db.programme.count({ where: { status: "PUBLISHED" } }),
    db.notification.count({ where: { channel: "WHATSAPP", status: "QUEUED" } }),
  ]);
  const K = (href: string, t: string, v: string | number, sub: string) => <a href={href} className="kpi" style={{ textDecoration: "none", color: "inherit" }}><span>{t}</span><b>{v}</b><small style={{ color: "var(--muted)" }}>{sub}</small></a>;
  return (<><div className="top"><h1>Today</h1><p>What needs attention. Everything here is live from the website and the admissions, finance and course records.</p></div>
    <div className="kpis">
      {K("/admissions", "New applications", newApps, `${today} in the last 24 hours`)}
      {K("/admissions", "Documents to verify", toVerify, "Received, not yet verified")}
      {K("/payments", "Unpaid invoices", unpaid._count, `RWF ${(unpaid._sum.amountMinor ?? 0).toLocaleString("en-US")} outstanding`)}
      {K("/enquiries", "New enquiries", enquiries, "Waiting for a reply")}
      {K("/admissions", "Admitted, not enrolled", admitted, "Ready to place in a class")}
      {K("/messages", "WhatsApp to send", waQueue, emailConfigured() ? "Email is sending automatically" : "Email not configured yet")}
      {K("/admin/courses", "Published courses", courses, "Open for registration all year")}
    </div>
    <div className="panel tbl" style={{ marginBottom: 16 }}><h2>Latest applications</h2><table><thead><tr><th>Received</th><th>Applicant</th><th>Programme</th><th>Placement</th><th>Status</th></tr></thead><tbody>
      {recent.length === 0 && <tr><td colSpan={5}>No applications yet.</td></tr>}
      {recent.map((a) => <tr key={a.id}><td>{a.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td><a href={`/admissions/${a.id}`}>{a.fullName}</a></td><td>{a.programme.name}</td><td>{a.branch.name} · {a.session === "WEEKDAY" ? "Weekday" : "Weekend"} · {a.intake.label}</td><td><span className="pill">{label(a.status)}</span></td></tr>)}
    </tbody></table></div>
    <div className="panel tbl"><h2>Latest enquiries</h2><table><tbody>
      {recentEnq.length === 0 && <tr><td>No enquiries yet.</td></tr>}
      {recentEnq.map((l) => <tr key={l.id}><td>{l.createdAt.toISOString().slice(0, 10)}</td><td>{l.name}</td><td>{l.phone ?? l.email}</td><td style={{ whiteSpace: "normal" }}>{l.message ?? "-"}</td><td><span className={`pill ${l.status === "NEW" ? "warn" : "ok"}`}>{label(l.status)}</span></td></tr>)}
    </tbody></table></div></>);
}
