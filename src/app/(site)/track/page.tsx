import type { Metadata } from "next";
import { db } from "@/lib/db";
import { label, money, STAGES } from "@/lib/format";
import { TrackUpload } from "@/components/TrackUpload";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Track your application | Timtom Aviation School", robots: { index: false } };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ ref?: string; who?: string }> }) {
  const { ref, who } = await searchParams;
  let a = null;
  if (ref && who) {
    const w = who.trim().toLowerCase(), digits = who.replace(/[^\d+]/g, "");
    const row = await db.applicant.findUnique({ where: { reference: ref.trim().toUpperCase() }, include: { programme: true, intake: true, branch: true, invoices: true, documents: true, events: { where: { type: { in: ["STATUS", "DOC", "PAYMENT", "PLACEMENT"] } }, orderBy: { createdAt: "desc" }, take: 12 } } });
    if (row && ((row.email && row.email === w) || (row.phone && digits && row.phone === digits))) a = row;
  }
  const NEXT: Record<string, string> = { SUBMITTED: "Admissions is reviewing your application and documents.", DOCUMENTS_VERIFIED: "Your documents are verified. If an invoice is shown below, pay it using the reference.", REGISTRATION_PAID: "Payment confirmed. Admissions will now make a decision.", ADMITTED: "You have been admitted. Admissions will confirm your class group.", ENROLLED: "You are enrolled. Welcome to Timtom Aviation School.", REJECTED: "Your application was not admitted. Contact admissions for guidance." };
  const idx = a ? STAGES.indexOf(a.status as (typeof STAGES)[number]) : -1;
  return (<><section className="pagehead"><div className="wrap"><div className="shead"><span className="eyebrow">Admissions</span><h1 style={{ fontSize: "clamp(2rem,1rem + 3vw,3.4rem)" }}>Track your application</h1><p className="lead">Enter the reference you received and the phone number or email you applied with.</p></div></div></section>
    <section className="sx" style={{ paddingTop: 24 }}><div className="wrap wzwrap vstack">
      <form className="wz" method="get">
        <div className="field"><label htmlFor="ref">Application reference</label><input id="ref" name="ref" defaultValue={ref ?? ""} placeholder="TAS-2611-ABCDE" required /></div>
        <div className="field"><label htmlFor="who">Phone or email used to apply</label><input id="who" name="who" defaultValue={who ?? ""} required /></div>
        <button className="btn pri" type="submit">Check status</button>
        {ref && who && !a && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>No application matches those details. Check the reference and try again.</p>}
      </form>
      {a && ref && who && (<div className="panel2 vstack" style={{ gap: 22 }}>
        <div><h2 style={{ fontSize: "1.6rem" }}>{a.programme.name}</h2><p style={{ color: "var(--mute)" }}>Start {a.intake.label} · {a.branch.name} · {a.session === "WEEKDAY" ? "Weekday" : "Weekend"} · Ref {a.reference}</p></div>
        <p className="note" role="status"><b>Next:</b> {NEXT[a.status]}</p>
        {a.status === "REJECTED" ? <p><span className="pillx bad">Not admitted</span></p> : <ol className="prog" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Application progress"><li style={{ display: "flex", gap: 6 }}>{STAGES.map((s, i) => <span key={s} style={{ flex: 1, textAlign: "center", fontSize: ".78rem", color: i <= idx ? "var(--blue)" : "var(--mute)", fontWeight: i === idx ? 700 : 500 }}><span style={{ display: "block", height: 6, borderRadius: 6, background: i <= idx ? "var(--blue)" : "#DCE7F6", marginBottom: 8 }} />{label(s)}</span>)}</li></ol>}
        <div><h3 style={{ marginBottom: 12 }}>Documents</h3><ul className="vstack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 12 }}>{a.documents.map((d) => (
          <li key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><span>{d.kind}{d.note ? <small style={{ color: "var(--mute)" }}> ({d.note})</small> : null}</span>
            <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span className={`pillx ${d.status === "VERIFIED" ? "ok" : d.status === "MISSING" ? "bad" : "warn"}`}>{label(d.status)}</span>
              {a.status !== "REJECTED" && d.status !== "VERIFIED" && <TrackUpload kind={d.kind} reference={a.reference!} who={who} />}</span></li>))}</ul></div>
        {a.events.length > 0 && <div><h3 style={{ marginBottom: 12 }}>Progress</h3><ul className="vstack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>{a.events.map((e) => <li key={e.id} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12 }}><span style={{ color: "var(--mute)", fontSize: ".9rem" }}>{e.createdAt.toISOString().slice(0, 10)}</span><span>{e.message}</span></li>)}</ul></div>}
        {a.invoices.length > 0 && <div><h3 style={{ marginBottom: 12 }}>Payment</h3>{a.invoices.map((i) => <p key={i.id} style={{ margin: "0 0 8px" }}>{i.description}: <b>{money(i.amountMinor, i.currency)}</b> · reference <b>{i.reference}</b> · <span className={`pillx ${i.status === "PAID" ? "ok" : "warn"}`}>{i.status === "PAID" ? "Paid" : "Awaiting payment"}</span></p>)}
          <p style={{ color: "var(--mute)", fontSize: ".95rem" }}>Use the invoice reference when you pay. Your status changes only after the School confirms the payment.</p></div>}
      </div>)}
    </div></section></>);
}
