import { db } from "@/lib/db";
import { label, money } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function Payments() {
  const rows = await db.payment.findMany({ include: { applicant: true }, orderBy: { paidAt: "desc" }, take: 100 });
  const tone = { RECONCILED: "ok", UNMATCHED: "bad", PART_PAYMENT: "warn" } as const;
  return (<><div className="top"><h1>Payments</h1><p>Mobile money and bank payments in RWF, USD and CDF</p></div>
    <div className="panel tbl"><table><thead><tr><th>Reference</th><th>Student</th><th>Channel</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      {rows.map((p) => <tr key={p.id}><td>{p.reference ?? "No reference"}</td><td>{p.applicant?.fullName ?? "Unknown payer"}</td><td>{label(p.channel)}</td>
        <td>{money(p.amountMinor, p.currency)}</td><td><span className={`pill ${tone[p.status]}`}>{label(p.status)}</span></td></tr>)}
    </tbody></table></div></>);
}
