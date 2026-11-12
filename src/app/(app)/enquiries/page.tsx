import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { label } from "@/lib/format";
import { ENQUIRY } from "@/lib/leads";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
import { getT } from "@/lib/i18n/server";
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
  const cname = (id: string | null) => courses.find((c) => c.id === id)?.name ?? "General question"; const { t } = await getT();
  const cols: Col[] = [{ key: "at", label: t("Received") }, { key: "name", label: t("Name") }, { key: "contact", label: t("Contact") }, { key: "about", label: t("About"), filter: true }, { key: "msg", label: t("Message") }, { key: "src", label: t("Source"), filter: true, hidden: true }, { key: "status", label: t("Status"), filter: true }, { key: "act", label: "", sortable: false }];
  const data: Row[] = rows.map((l) => ({ id: l.id, v: { at: l.createdAt.toISOString().slice(0, 16).replace("T", " "), name: l.name, contact: l.phone ?? l.email ?? "", about: cname(l.programmeId), msg: l.message ?? "", src: (l.utmSource ?? l.source) + (l.utmCampaign ? ` · ${l.utmCampaign}` : ""), status: label(l.status) },
    c: { msg: <span style={{ whiteSpace: "normal", display: "block", maxWidth: 320 }}>{l.message ?? "-"}</span>, status: <><span className={`pill ${l.status === "NEW" ? "warn" : l.status === "CLOSED" ? "" : "ok"}`}>{label(l.status)}</span>{l.handledBy && <small style={{ display: "block", color: "var(--muted)" }}>{l.handledBy}</small>}</>,
      act: <form style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={l.id} />{l.status !== "CONTACTED" && <button className="s" formAction={setStatus.bind(null, "CONTACTED")}>Contacted</button>}{l.status !== "CLOSED" && <button className="s" formAction={setStatus.bind(null, "CLOSED")}>Close</button>}</form> } }));
  return (<><div className="top"><div><h1>{t("Enquiries")}</h1><p>{t("Questions sent from the website. Contact the person, then mark the enquiry.")}</p></div></div>
    <form className="panel" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}><label htmlFor="s"><b>{t("Show")}</b></label>
      <select id="s" name="s" defaultValue={s ?? ""}><option value="">{t("All")}</option>{["NEW", "CONTACTED", "CLOSED"].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select><button type="submit">{t("Filter")}</button></form>
    <div className="panel"><DataTable id="enquiries" cols={cols} rows={data} exportName="enquiries" empty={t("No enquiries yet.")} /></div></>);
}
