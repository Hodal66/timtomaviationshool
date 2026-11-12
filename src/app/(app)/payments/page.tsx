import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { label, money } from "@/lib/format";
import { advanceApplicant } from "@/lib/admissions";
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
  if (inv.applicant.status === "DOCUMENTS_VERIFIED") await advanceApplicant(inv.applicantId, "System");
  revalidatePath("/payments"); revalidatePath("/admissions");
  redirect("/payments");
}

export default async function Payments({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams; const me = await getSession();
  const [rows, pending] = await Promise.all([
    db.payment.findMany({ include: { applicant: true }, orderBy: { paidAt: "desc" }, take: 100 }),
    db.invoice.findMany({ where: { status: "PENDING" }, include: { applicant: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const tone = { RECONCILED: "ok", UNMATCHED: "bad", PART_PAYMENT: "warn" } as const;
  return (<><div className="top"><h1>Payments</h1><p>Invoices from online applications wait here until Finance verifies the money.</p></div>
    {e && <p className="err" role="alert">{e}</p>}
    <div className="panel tbl" style={{ marginBottom: 16 }}><h2>Invoices awaiting payment</h2><table><thead><tr><th>Invoice</th><th>Applicant</th><th>Amount</th><th>Verify payment</th></tr></thead><tbody>
      {pending.length === 0 && <tr><td colSpan={4}>No unpaid invoices.</td></tr>}
      {pending.map((i) => <tr key={i.id}><td>{i.reference}</td><td>{i.applicant.fullName}</td><td>{money(i.amountMinor, i.currency)}</td>
        <td>{me && can.finance(me.role) ? <form action={verify} style={{ display: "flex", gap: 4 }}><input type="hidden" name="invoiceId" value={i.id} />
          <select name="channel" aria-label="Channel">{["MTN_MOMO", "AIRTEL_MONEY", "BANK_OF_KIGALI", "IM_BANK", "EQUITY", "CASH"].map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
          <input name="reference" placeholder="Transaction reference" aria-label="Transaction reference" required /><button className="s" type="submit">Mark verified</button></form> : "Finance only"}</td></tr>)}
    </tbody></table></div>
    <div className="panel tbl"><h2>Transaction history</h2><table><thead><tr><th>Reference</th><th>Student</th><th>Channel</th><th>Amount</th><th>Verified by</th><th>Status</th></tr></thead><tbody>
      {rows.map((p) => <tr key={p.id}><td>{p.reference ?? "No reference"}</td><td>{p.applicant?.fullName ?? "Unknown payer"}</td><td>{label(p.channel)}</td><td>{money(p.amountMinor, p.currency)}</td><td>{p.verifiedBy ?? "-"}</td><td><span className={`pill ${tone[p.status]}`}>{label(p.status)}</span></td></tr>)}
    </tbody></table></div></>);
}
