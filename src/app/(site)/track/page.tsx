import { db } from "@/lib/db";
import { label, money, STAGES } from "@/lib/format";
export const dynamic = "force-dynamic";

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ ref?: string; who?: string }> }) {
  const { ref, who } = await searchParams;
  let a = null;
  if (ref && who) {
    const w = who.trim().toLowerCase(), digits = who.replace(/[^\d+]/g, "");
    const row = await db.applicant.findUnique({ where: { reference: ref.trim().toUpperCase() }, include: { programme: true, intake: true, branch: true, invoices: true, documents: true } });
    if (row && ((row.email && row.email === w) || (row.phone && digits && row.phone === digits))) a = row;
  }
  return (<div className="wrap sec"><h1>Track your application</h1>
    <form className="form" style={{ marginBottom: 24 }}>
      <label htmlFor="ref">Application reference</label><input id="ref" name="ref" defaultValue={ref ?? ""} placeholder="TAS-2611-ABCDE" />
      <label htmlFor="who">Phone or email used to apply</label><input id="who" name="who" defaultValue={who ?? ""} />
      <button className="btn" type="submit">Check status</button></form>
    {ref && who && !a && <p className="err" role="alert">No application matches those details.</p>}
    {a && (<div className="panel"><h2>{a.programme.name}</h2>
      <p>{a.intake.label} · {a.branch.name} · {a.session === "WEEKDAY" ? "Weekday" : "Weekend"}</p>
      <p><b>Status:</b> {a.status === "REJECTED" ? <span className="pill bad">Not admitted</span> : <span className="pill ok">{label(a.status)}</span>}</p>
      {a.status !== "REJECTED" && <p style={{ color: "var(--muted)" }}>Steps: {STAGES.map((s) => label(s)).join(" → ")}</p>}
      <h2 style={{ marginTop: 16 }}>Documents</h2><ul className="ol">{a.documents.map((d) => <li key={d.id}>{d.kind}: <span className={`pill ${d.status === "VERIFIED" ? "ok" : d.status === "MISSING" ? "bad" : "warn"}`}>{label(d.status)}</span>{d.note ? ` (${d.note})` : ""}</li>)}</ul>
      {a.invoices.length > 0 && <><h2 style={{ marginTop: 16 }}>Payment</h2><ul className="ol">{a.invoices.map((i) => <li key={i.id}>{i.description}: {money(i.amountMinor, i.currency)} · reference <b>{i.reference}</b> · <span className={`pill ${i.status === "PAID" ? "ok" : "warn"}`}>{i.status === "PAID" ? "Paid" : "Awaiting payment"}</span></li>)}</ul>
        <p style={{ color: "var(--muted)" }}>Use the invoice reference when you pay. Your status changes only after the School confirms the payment.</p></>}
    </div>)}
  </div>);
}
