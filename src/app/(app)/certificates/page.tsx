import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Certificates() {
  const rows = await db.certificate.findMany({ include: { holder: true, programme: true }, orderBy: { issuedOn: "desc" } });
  return (<><div className="top"><h1>Certificates</h1><p>Public verification at <a href="/verify">/verify</a></p></div>
    <div className="panel tbl"><table><thead><tr><th>Number</th><th>Holder</th><th>Programme</th><th>Issuer</th><th>Status</th></tr></thead><tbody>
      {rows.map((c) => <tr key={c.id}><td>{c.number}</td><td>{c.holder.fullName}</td><td>{c.programme.name}</td><td>{c.issuer}</td>
        <td><span className={`pill ${c.status === "VALID" ? "ok" : "bad"}`}>{c.status === "VALID" ? "Valid" : "Revoked"}</span></td></tr>)}
    </tbody></table></div></>);
}
