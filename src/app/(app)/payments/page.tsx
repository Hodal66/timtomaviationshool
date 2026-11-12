import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { label, money } from "@/lib/format";
import { advanceApplicant } from "@/lib/admissions";
import { COPY, notifyApplicant } from "@/lib/notify";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";

/** Finance-only. The public website can never reach this: it requires a signed-in Finance or Admin user and a bank or mobile-money reference. */
async function verify(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !can.finance(s.role)) throw new Error("Not allowed");
  const invoiceId = String(fd.get("invoiceId")), reference = String(fd.get("reference") ?? "").trim().slice(0, 60), channel = String(fd.get("channel"));
  if (!reference) redirect("/payments?e=" + encodeURIComponent("Enter the bank or mobile-money transaction reference."));
  if (await db.payment.findUnique({ where: { reference } })) redirect("/payments?e=" + encodeURIComponent("That transaction reference was already recorded."));
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { applicant: true } });
  if (!inv || inv.status !== "PENDING") return;
  await db.$transaction([
    db.payment.create({ data: { reference, amountMinor: inv.amountMinor, currency: inv.currency, channel: channel as never, status: "RECONCILED", applicantId: inv.applicantId, invoiceId: inv.id, verifiedBy: s.name } }),
    db.invoice.update({ where: { id: inv.id }, data: { status: "PAID", paidAt: new Date() } }),
    db.applicationEvent.create({ data: { applicantId: inv.applicantId, type: "PAYMENT", actorName: s.name, message: `Payment verified by Finance (${reference}).` } }),
  ]);
  // If documents are already verified, the application moves to "Registration paid" on its own.
  if (inv.applicant.status === "DOCUMENTS_VERIFIED") await advanceApplicant(inv.applicantId, "System"); // sends the status message
  else await notifyApplicant(inv.applicantId, (ap) => COPY.paid(ap, inv.reference));
  revalidatePath("/payments"); revalidatePath("/admissions");
  redirect("/payments");
}

export default async function Payments({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams; const me = await getSession(); if (!me || !can.viewApplicants(me.role)) redirect("/dashboard");
  const [rows, pending] = await Promise.all([
    db.payment.findMany({ include: { applicant: true }, orderBy: { paidAt: "desc" }, take: 100 }),
    db.invoice.findMany({ where: { status: "PENDING" }, include: { applicant: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const { t } = await getT(); const tone = { RECONCILED: "ok", UNMATCHED: "bad", PART_PAYMENT: "warn" } as const;
  const pcols: Col[] = [{ key: "inv", label: t("Invoice") }, { key: "who", label: t("Applicant") }, { key: "amt", label: t("Amount"), align: "right" }, { key: "date", label: t("Raised") }, { key: "act", label: t("Verify payment"), sortable: false }];
  const prow: Row[] = pending.map((i) => ({ id: i.id, v: { inv: i.reference, who: i.applicant.fullName, amt: Number(i.amountMinor), date: i.createdAt.toISOString().slice(0, 10) }, c: { amt: money(i.amountMinor, i.currency),
    act: me && can.finance(me.role) ? <form action={verify} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}><input type="hidden" name="invoiceId" value={i.id} />
      <select name="channel" aria-label="Channel">{["MTN_MOMO", "AIRTEL_MONEY", "BANK_OF_KIGALI", "IM_BANK", "EQUITY", "CASH"].map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
      <input name="reference" placeholder={t("Transaction reference")} aria-label="Transaction reference" required /><button className="s" type="submit">{t("Mark verified")}</button></form> : t("Finance only") } }));
  const hcols: Col[] = [{ key: "ref", label: t("Reference") }, { key: "who", label: t("Student") }, { key: "channel", label: t("Channel"), filter: true }, { key: "amt", label: t("Amount"), align: "right" }, { key: "by", label: t("Verified by"), filter: true }, { key: "status", label: t("Status"), filter: true }, { key: "date", label: t("Date") }];
  const hrow: Row[] = rows.map((p) => ({ id: p.id, v: { ref: p.reference ?? "", who: p.applicant?.fullName ?? "Unknown payer", channel: label(p.channel), amt: Number(p.amountMinor), by: p.verifiedBy ?? "", status: label(p.status), date: p.paidAt.toISOString().slice(0, 10) }, c: { amt: money(p.amountMinor, p.currency), status: <span className={`pill ${tone[p.status]}`}>{label(p.status)}</span> } }));
  return (<><div className="top"><div><h1>{t("Payments")}</h1><p>{t("Invoices from online applications wait here until Finance verifies the money.")}</p></div></div>
    {e && <p className="err" role="alert">{e}</p>}
    <div className="panel" style={{ marginBottom: 16 }}><h2>{t("Invoices awaiting payment")}</h2><DataTable id="invoices" cols={pcols} rows={prow} exportName="unpaid-invoices" empty={t("No unpaid invoices.")} /></div>
    <div className="panel"><h2>{t("Transaction history")}</h2><DataTable id="payments" cols={hcols} rows={hrow} exportName="payments" empty={t("No payments yet.")} /></div></>);
}
