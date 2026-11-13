import { db } from "@/lib/db";
import { letterCodeOk, LETTER_STAGES } from "@/lib/letter";
import { label } from "@/lib/format";
export const dynamic = "force-dynamic";

export default async function Verify({ searchParams }: { searchParams: Promise<{ n?: string; letter?: string; k?: string }> }) {
  const sp = await searchParams; const n = sp.n?.trim().toUpperCase();
  const lref = sp.letter?.trim().toUpperCase(), lk = sp.k?.trim() ?? "";
  const la = lref && letterCodeOk(lref, lk) ? await db.applicant.findUnique({ where: { reference: lref }, include: { programme: true, branch: true, intake: true } }) : null;
  const letterOk = !!la && LETTER_STAGES.includes(la.status);
  const c = n ? await db.certificate.findUnique({ where: { number: n }, include: { holder: true, programme: true } }) : null;
  return (<div className="center"><div className="box" style={{ maxWidth: 480 }}>
    <h1>Verify a certificate</h1>
    <form style={{ display: "flex", gap: 8 }}><input name="n" defaultValue={n ?? ""} placeholder="TAS-2027-004281" aria-label="Certificate number" style={{ flex: 1 }} />
      <button className="p" type="submit">Verify</button></form>
    {n && !c && <p className="err"><b>Not found.</b> Check the number on the certificate or scan its QR code.</p>}
    {c && c.status === "VALID" && <p><span className="pill ok">Valid</span><br /><b>{c.number}</b> was issued to {c.holder.fullName} for {c.programme.name} by {c.issuer} on {c.issuedOn.toISOString().slice(0, 10)}.</p>}
    {c && c.status === "REVOKED" && <p className="err"><b>Revoked.</b> This certificate must not be accepted.</p>}
    <hr style={{ width: "100%", border: 0, borderTop: "1px solid var(--line)" }} />
    <h2 style={{ fontSize: 16 }}>Verify an admission letter</h2>
    <form style={{ display: "grid", gap: 8 }}><input name="letter" defaultValue={lref ?? ""} placeholder="TAS-2611-ABCDE" aria-label="Application reference" /><input name="k" defaultValue={lk} placeholder="Verification code" aria-label="Verification code" /><button className="p" type="submit">Verify letter</button></form>
    {lref && !letterOk && <p className="err"><b>Not confirmed.</b> The reference and code do not match an admission letter issued by the School.</p>}
    {letterOk && la && <p><span className="pill ok">Genuine</span><br />Admission letter <b>{la.reference}</b>: {la.fullName} is {la.status === "ENROLLED" ? "enrolled in" : "admitted to"} {la.programme.name}, {la.branch.name}, {la.intake.label} intake. Current status: {label(la.status)}.</p>}
  </div></div>);
}
