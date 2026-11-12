import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

export default async function Verify({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const n = (await searchParams).n?.trim().toUpperCase();
  const c = n ? await db.certificate.findUnique({ where: { number: n }, include: { holder: true, programme: true } }) : null;
  return (<div className="center"><div className="box" style={{ maxWidth: 480 }}>
    <h1>Verify a certificate</h1>
    <form style={{ display: "flex", gap: 8 }}><input name="n" defaultValue={n ?? ""} placeholder="TAS-2027-004281" aria-label="Certificate number" style={{ flex: 1 }} />
      <button className="p" type="submit">Verify</button></form>
    {n && !c && <p className="err"><b>Not found.</b> Check the number on the certificate or scan its QR code.</p>}
    {c && c.status === "VALID" && <p><span className="pill ok">Valid</span><br /><b>{c.number}</b> was issued to {c.holder.fullName} for {c.programme.name} by {c.issuer} on {c.issuedOn.toISOString().slice(0, 10)}.</p>}
    {c && c.status === "REVOKED" && <p className="err"><b>Revoked.</b> This certificate must not be accepted.</p>}
  </div></div>);
}
