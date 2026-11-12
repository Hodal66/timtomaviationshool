import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { label } from "@/lib/format";
import { ENQUIRY } from "@/lib/leads";
export const dynamic = "force-dynamic";

async function setStatus(status: string, fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !can.enquiries(s.role)) throw new Error("Not allowed");
  if (!["NEW", "CONTACTED", "CLOSED"].includes(status)) return;
  await db.lead.update({ where: { id: String(fd.get("id")) }, data: { status: status as never, handledBy: s.name } });
  revalidatePath("/enquiries"); revalidatePath("/dashboard");
}

/** Questions from the website contact and course forms (ADM-01). Applications create their own lead record and are excluded here. */
export default async function Enquiries({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const me = await getSession(); if (!me || !can.enquiries(me.role)) redirect("/dashboard");
  const { s } = await searchParams;
  const where = { AND: [ENQUIRY, ...(s ? [{ status: s as never }] : [])] };
  const [rows, courses] = await Promise.all([db.lead.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }), db.programme.findMany({ select: { id: true, name: true } })]);
  const cname = (id: string | null) => courses.find((c) => c.id === id)?.name ?? "General question";
  return (<><div className="top"><h1>Enquiries</h1><p>Questions sent from the website. Contact the person, then mark the enquiry.</p></div>
    <form className="panel" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}><label htmlFor="s"><b>Show</b></label>
      <select id="s" name="s" defaultValue={s ?? ""}><option value="">All</option>{["NEW", "CONTACTED", "CLOSED"].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select><button type="submit">Filter</button></form>
    <div className="panel tbl"><table><thead><tr><th>Received</th><th>Name</th><th>Contact</th><th>About</th><th>Message</th><th>Source</th><th>Status</th><th></th></tr></thead><tbody>
      {rows.length === 0 && <tr><td colSpan={8}>No enquiries yet.</td></tr>}
      {rows.map((l) => <tr key={l.id}><td>{l.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td>{l.name}</td><td>{l.phone ?? l.email}</td><td>{cname(l.programmeId)}</td>
        <td style={{ whiteSpace: "normal", maxWidth: 320 }}>{l.message ?? "-"}</td><td>{l.utmSource ?? l.source}{l.utmCampaign ? ` · ${l.utmCampaign}` : ""}</td>
        <td><span className={`pill ${l.status === "NEW" ? "warn" : l.status === "CLOSED" ? "" : "ok"}`}>{label(l.status)}</span>{l.handledBy && <small style={{ display: "block", color: "var(--muted)" }}>{l.handledBy}</small>}</td>
        <td><form style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={l.id} />{l.status !== "CONTACTED" && <button className="s" formAction={setStatus.bind(null, "CONTACTED")}>Contacted</button>}{l.status !== "CLOSED" && <button className="s" formAction={setStatus.bind(null, "CLOSED")}>Close</button>}{l.status !== "NEW" && <button className="s" formAction={setStatus.bind(null, "NEW")}>Reopen</button>}</form></td></tr>)}
    </tbody></table></div></>);
}
