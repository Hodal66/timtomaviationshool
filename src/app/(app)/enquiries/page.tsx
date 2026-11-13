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

const CHANNELS = ["WhatsApp", "Phone call", "Walk-in", "Facebook", "Instagram", "TikTok", "Email", "Referral", "Event"] as const;
/** ADM-01: staff record enquiries that arrive outside the website, so every channel lands in one list with its source. */
async function addEnquiry(fd: FormData) {
  "use server";
  const s = await getSession();
  if (!s || !can.enquiries(s.role)) throw new Error("Not allowed");
  const name = String(fd.get("name") ?? "").trim().slice(0, 120), contact = String(fd.get("contact") ?? "").trim().slice(0, 160), source = String(fd.get("source")), message = String(fd.get("message") ?? "").trim().slice(0, 1000), programmeId = String(fd.get("programmeId") ?? "") || null;
  if (!name || !contact || !CHANNELS.includes(source as never)) redirect("/enquiries?e=" + encodeURIComponent("Enter a name, a phone or email, and the channel."));
  await db.lead.create({ data: { name, ...(contact.includes("@") ? { email: contact.toLowerCase() } : { phone: contact }), source, message: message || `Enquiry by ${source.toLowerCase()}, recorded by ${s.name}.`, programmeId, handledBy: s.name } });
  revalidatePath("/enquiries"); revalidatePath("/dashboard"); redirect("/enquiries?ok=1");
}

/** Questions from the website contact and course forms (ADM-01). Applications create their own lead record and are excluded here. */
export default async function Enquiries({ searchParams }: { searchParams: Promise<{ s?: string; e?: string; ok?: string }> }) {
  const me = await getSession(); if (!me || !can.enquiries(me.role)) redirect("/dashboard");
  const { s, e, ok } = await searchParams;
  const where = { AND: [ENQUIRY, ...(s ? [{ status: s as never }] : [])] };
  const [rows, courses] = await Promise.all([db.lead.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }), db.programme.findMany({ select: { id: true, name: true } })]);
  const cname = (id: string | null) => courses.find((c) => c.id === id)?.name ?? "General question"; const { t } = await getT();
  const cols: Col[] = [{ key: "at", label: t("Received") }, { key: "name", label: t("Name") }, { key: "contact", label: t("Contact") }, { key: "about", label: t("About"), filter: true }, { key: "msg", label: t("Message") }, { key: "src", label: t("Source"), filter: true }, { key: "status", label: t("Status"), filter: true }, { key: "act", label: "", sortable: false }];
  const data: Row[] = rows.map((l) => ({ id: l.id, v: { at: l.createdAt.toISOString().slice(0, 16).replace("T", " "), name: l.name, contact: l.phone ?? l.email ?? "", about: cname(l.programmeId), msg: l.message ?? "", src: (l.utmSource ?? l.source) + (l.utmCampaign ? ` · ${l.utmCampaign}` : ""), status: label(l.status) },
    c: { msg: <span style={{ whiteSpace: "normal", display: "block", maxWidth: 320 }}>{l.message ?? "-"}</span>, status: <><span className={`pill ${l.status === "NEW" ? "warn" : l.status === "CLOSED" ? "" : "ok"}`}>{label(l.status)}</span>{l.handledBy && <small style={{ display: "block", color: "var(--muted)" }}>{l.handledBy}</small>}</>,
      act: <form style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={l.id} />{l.status !== "CONTACTED" && <button className="s" formAction={setStatus.bind(null, "CONTACTED")}>Contacted</button>}{l.status !== "CLOSED" && <button className="s" formAction={setStatus.bind(null, "CLOSED")}>Close</button>}</form> } }));
  return (<><div className="top"><div><h1>{t("Enquiries")}</h1><p>{t("Questions sent from the website. Contact the person, then mark the enquiry.")}</p></div></div>
    <form className="panel" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}><label htmlFor="s"><b>{t("Show")}</b></label>
      <select id="s" name="s" defaultValue={s ?? ""}><option value="">{t("All")}</option>{["NEW", "CONTACTED", "CLOSED"].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select><button type="submit">{t("Filter")}</button></form>
    {e && <p className="err" role="alert">{e}</p>}{ok && <p className="ok" role="status">{t("Saved.")}</p>}
    <form action={addEnquiry} className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}><b style={{ width: "100%" }}>{t("Record an enquiry from another channel")}</b>
      <input name="name" placeholder={t("Name")} aria-label={t("Name")} required /><input name="contact" placeholder={t("Phone or email")} aria-label={t("Phone or email")} required />
      <select name="source" aria-label={t("Channel")}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
      <select name="programmeId" aria-label={t("Programme")}><option value="">{t("General question")}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input name="message" placeholder={t("What they asked")} aria-label={t("What they asked")} style={{ flex: 1, minWidth: 200 }} /><button className="p" type="submit">{t("Add")}</button></form>
    <div className="panel"><DataTable id="enquiries" cols={cols} rows={data} exportName="enquiries" empty={t("No enquiries yet.")} /></div></>);
}
