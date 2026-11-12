import { db } from "@/lib/db";
import { label } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function Programmes() {
  const rows = await db.programme.findMany({ orderBy: { name: "asc" } });
  return (<><div className="top"><h1>Programmes</h1><p>One catalogue for every channel</p></div>
    <div className="panel tbl"><table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Months</th><th>Fee RWF</th><th>Fee USD</th></tr></thead><tbody>
      {rows.map((p) => <tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td>{label(p.type)}</td><td>{p.durationMonths}</td><td>{p.feeRwf.toLocaleString("en-US")}</td><td>{p.feeUsd}</td></tr>)}
    </tbody></table></div></>);
}
