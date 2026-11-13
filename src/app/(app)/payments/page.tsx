import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { label, money } from "@/lib/format";
import { recordPayment, matchStatement, outstandingOn, CHANNELS, CURRENCIES, getRates } from "@/lib/finance";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

const fin = async () => { const s = await getSession(); if (!s || !can.finance(s.role)) throw new Error("Not allowed"); return s; };
const done = (e?: string | null, ok?: string) => { revalidatePath("/payments"); revalidatePath("/admissions"); redirect("/payments" + (e ? "?e=" + encodeURIComponent(e) : ok ? "?ok=" + encodeURIComponent(ok) : "")); };
/** Finance-only. The public website can never reach this: it requires a signed-in Finance or Admin user and a bank or mobile-money reference. */
async function verify(fd: FormData) {
  "use server";
  const s = await fin(); const cur = String(fd.get("currency") ?? "RWF"); const amt = Number(String(fd.get("amount") ?? "").replace(/[^\d.]/g, ""));
  done(await recordPayment({ invoiceId: String(fd.get("invoiceId")), reference: String(fd.get("reference") ?? ""), channel: String(fd.get("channel")), amountMinor: amt > 0 ? (cur === "USD" ? Math.round(amt * 100) : amt) : undefined, currency: cur, actor: s.name }));
}
async function confirmClaim(fd: FormData) {
  "use server";
  const s = await fin(); const c = await db.payment.findUnique({ where: { id: String(fd.get("id")) } }); if (!c || c.status !== "UNMATCHED" || !c.invoiceId) return done("That reported payment is no longer waiting.");
  done(await recordPayment({ invoiceId: c.invoiceId, reference: c.reference!, channel: c.channel, amountMinor: c.amountMinor, currency: c.currency, actor: s.name }, c.id));
}
async function rejectClaim(fd: FormData) {
  "use server";
  const s = await fin(); const c = await db.payment.findUnique({ where: { id: String(fd.get("id")) } }); if (!c || c.status !== "UNMATCHED") return done();
  await db.payment.delete({ where: { id: c.id } }); if (c.applicantId) await db.applicationEvent.create({ data: { applicantId: c.applicantId, type: "PAYMENT", actorName: s.name, message: `Reported payment ${c.reference} was not found by Finance and was removed.` } });
  done(null, "Reported payment removed.");
}
async function importStatement(fd: FormData) {
  "use server";
  const s = await fin(); const r = await matchStatement(String(fd.get("lines") ?? ""), s.name);
  done(null, `${r.lines} statement lines read: ${r.matched} matched and confirmed, ${r.amountMismatch.length} with a different amount${r.amountMismatch.length ? " (" + r.amountMismatch.slice(0, 5).join(", ") + ")" : ""}, ${r.unknown.length} not matched to a reported payment.`);
}
async function setRate(fd: FormData) {
  "use server";
  const s = await fin(); const currency = String(fd.get("currency")), rate = Number(fd.get("rate")); if (!["USD", "CDF"].includes(currency) || !(rate > 0)) return done("Enter a rate greater than zero.");
  await db.exchangeRate.upsert({ where: { currency: currency as never }, update: { rwfPerUnit: rate, updatedBy: s.name }, create: { currency: currency as never, rwfPerUnit: rate, updatedBy: s.name } }); done(null, `${currency} rate saved.`);
}

export default async function Payments({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const { e, ok } = await searchParams; const me = await getSession(); if (!me || !can.viewApplicants(me.role)) redirect("/dashboard");
  const [rows, pending, claims, rates, rateRows] = await Promise.all([
    db.payment.findMany({ where: { status: { not: "UNMATCHED" } }, include: { applicant: true }, orderBy: { paidAt: "desc" }, take: 300 }),
    db.invoice.findMany({ where: { status: "PENDING" }, include: { applicant: true, payments: true }, orderBy: { createdAt: "asc" } }),
    db.payment.findMany({ where: { status: "UNMATCHED", claimedBy: "APPLICANT" }, include: { applicant: true, invoice: true }, orderBy: { paidAt: "asc" } }),
    getRates(), db.exchangeRate.findMany(),
  ]); const isFin = can.finance(me.role);
  const { t } = await getT(); const tone = { RECONCILED: "ok", UNMATCHED: "bad", PART_PAYMENT: "warn" } as const;
  const pcols: Col[] = [{ key: "inv", label: t("Invoice") }, { key: "who", label: t("Applicant") }, { key: "kind", label: t("Type"), filter: true }, { key: "amt", label: t("Amount"), align: "right" }, { key: "left", label: t("Still due"), align: "right" }, { key: "due", label: t("Due date") }, { key: "act", label: t("Verify payment"), sortable: false }];
  const prow: Row[] = pending.map((i) => ({ id: i.id, v: { inv: i.reference, who: i.applicant.fullName, kind: i.kind === "TUITION" ? "Tuition" : "Registration", amt: Number(i.amountMinor), left: outstandingOn(i), due: i.dueOn?.toISOString().slice(0, 10) ?? "" }, c: { amt: money(i.amountMinor, i.currency), left: money(outstandingOn(i), "RWF"), due: i.dueOn ? <span className={i.dueOn < new Date() ? "pill bad" : "pill"}>{i.dueOn.toISOString().slice(0, 10)}</span> : "",
    act: me && can.finance(me.role) ? <form action={verify} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}><input type="hidden" name="invoiceId" value={i.id} />
      <select name="channel" aria-label="Channel">{CHANNELS.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
      <input name="amount" inputMode="decimal" placeholder={t("Amount (blank = all)")} aria-label="Amount" style={{ width: 150 }} /><select name="currency" aria-label="Currency">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
      <input name="reference" placeholder={t("Transaction reference")} aria-label="Transaction reference" required /><button className="s" type="submit">{t("Mark verified")}</button></form> : t("Finance only") } }));
  const hcols: Col[] = [{ key: "ref", label: t("Reference") }, { key: "who", label: t("Student") }, { key: "channel", label: t("Channel"), filter: true }, { key: "amt", label: t("Amount"), align: "right" }, { key: "by", label: t("Verified by"), filter: true }, { key: "status", label: t("Status"), filter: true }, { key: "date", label: t("Date") }];
  const hrow: Row[] = rows.map((p) => ({ id: p.id, v: { ref: p.reference ?? "", who: p.applicant?.fullName ?? "Unknown payer", channel: label(p.channel), amt: Number(p.valueRwf ?? p.amountMinor), by: p.verifiedBy ?? "", status: label(p.status), date: p.paidAt.toISOString().slice(0, 10) }, c: { amt: p.currency === "RWF" ? money(p.amountMinor, "RWF") : `${money(p.amountMinor, p.currency)} = ${money(p.valueRwf ?? 0, "RWF")}`, status: <span className={`pill ${tone[p.status]}`}>{label(p.status)}</span> } }));
  return (<><div className="top"><div><h1>{t("Payments")}</h1><p>{t("Invoices from online applications wait here until Finance verifies the money.")}</p></div></div>
    {e && <p className="err" role="alert">{e}</p>}{ok && <p className="ok" role="status">{ok}</p>}
    {claims.length > 0 && <div className="panel" style={{ marginBottom: 16 }}><h2>{t("Payments reported by applicants")} <span className="pill warn">{claims.length}</span></h2>
      <div className="tbl" tabIndex={0} role="region" aria-label={t("Payments reported by applicants")}><table><thead><tr><th>{t("Reference")}</th><th>{t("Applicant")}</th><th>{t("Invoice")}</th><th>{t("Channel")}</th><th>{t("Amount")}</th><th /></tr></thead><tbody>
        {claims.map((c) => <tr key={c.id}><td>{c.reference}</td><td>{c.applicant?.fullName}</td><td>{c.invoice?.reference}</td><td>{label(c.channel)}</td><td>{money(c.amountMinor, c.currency)}</td>
          <td>{isFin ? <form style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={c.id} /><button className="s" formAction={confirmClaim}>{t("Confirm")}</button><button className="s danger" formAction={rejectClaim}>{t("Not found")}</button></form> : t("Finance only")}</td></tr>)}</tbody></table></div></div>}
    <div className="panel" style={{ marginBottom: 16 }}><h2>{t("Invoices awaiting payment")}</h2><DataTable id="invoices" cols={pcols} rows={prow} exportName="unpaid-invoices" empty={t("No unpaid invoices.")} /></div>
    {isFin && <div className="grid2" style={{ marginBottom: 16 }}>
      <form action={importStatement} className="panel" style={{ display: "grid", gap: 8 }}><h2 style={{ marginBottom: 0 }}>{t("Match a bank or mobile-money statement")}</h2><p style={{ margin: 0, color: "var(--muted)" }}>{t("Paste statement lines as: transaction reference, amount. Reported payments with the same reference and amount are confirmed automatically.")}</p>
        <textarea name="lines" rows={4} aria-label={t("Statement lines")} placeholder={"MP241113.1234.A56789, 25000"} required /><button type="submit" style={{ justifySelf: "start" }}>{t("Match statement")}</button></form>
      <div className="panel"><h2>{t("Exchange rates")}</h2><p style={{ margin: "0 0 8px", color: "var(--muted)" }}>{t("How many RWF one unit is worth. Used when a payment is made in USD or CDF.")}</p>
        {(["USD", "CDF"] as const).map((c) => <form key={c} action={setRate} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}><input type="hidden" name="currency" value={c} /><b style={{ width: 40 }}>{c}</b><input name="rate" type="number" step="0.0001" min="0" defaultValue={rates[c] ?? ""} aria-label={`${c} rate`} style={{ width: 130 }} required /><button className="s" type="submit">{t("Save")}</button><small style={{ color: "var(--muted)" }}>{rateRows.find((r) => r.currency === c)?.updatedAt.toISOString().slice(0, 10) ?? t("not set")}</small></form>)}</div></div>}
    <div className="panel"><h2>{t("Transaction history")}</h2><DataTable id="payments" cols={hcols} rows={hrow} exportName="payments" empty={t("No payments yet.")} /></div></>);
}
