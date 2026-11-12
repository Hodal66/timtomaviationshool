import { db } from "@/lib/db";
import { label } from "@/lib/format";
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [total, byStatus, unmatched, collected, revoked] = await Promise.all([
    db.applicant.count(),
    db.applicant.groupBy({ by: ["status"], _count: true }),
    db.payment.count({ where: { status: { not: "RECONCILED" } } }),
    db.payment.aggregate({ _sum: { amountMinor: true }, where: { currency: "RWF" } }),
    db.certificate.count({ where: { status: "REVOKED" } }),
  ]);
  return (<><div className="top"><h1>Dashboard</h1><p>Live from the Neon database</p></div>
    <div className="kpis">
      <div className="kpi"><span>Applicants</span><b>{total}</b></div>
      <div className="kpi"><span>Collected (RWF)</span><b>{(collected._sum.amountMinor ?? 0).toLocaleString("en-US")}</b></div>
      <div className="kpi"><span>Payments needing review</span><b>{unmatched}</b></div>
      <div className="kpi"><span>Revoked certificates</span><b>{revoked}</b></div>
    </div>
    <div className="panel"><h2>Applications by stage</h2><div className="tbl"><table><tbody>
      {byStatus.map((r) => <tr key={r.status}><td>{label(r.status)}</td><td>{r._count}</td></tr>)}
    </tbody></table></div></div></>);
}
