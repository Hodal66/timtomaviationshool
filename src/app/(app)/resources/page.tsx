import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { label } from "@/lib/format";
import { AUTHORS, REVIEWERS, KINDS, LICENCES, BIN_DAYS, copyModule, reviewResource, restoreResource, purgeResource } from "@/lib/resources";
import { ResourceUpload } from "@/components/ResourceUpload";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
export const dynamic = "force-dynamic";

const actor = async () => { const s = await getSession(); if (!s || !AUTHORS.includes(s.role)) throw new Error("Not allowed"); return { uid: s.uid, name: s.name, role: s.role }; };
const go = (view: string, r: string | null | { copied: number }) => redirect(`/resources?view=${view}&` + (typeof r === "string" ? "e=" + encodeURIComponent(r) : r ? `copied=${r.copied}` : "ok=1"));
async function review(approve: boolean, fd: FormData) { "use server"; const err = await reviewResource(await actor(), String(fd.get("id")), approve, String(fd.get("note") ?? "")); revalidatePath("/resources"); go("review", err); }
async function restore(fd: FormData) { "use server"; const err = await restoreResource(await actor(), String(fd.get("id"))); revalidatePath("/resources"); go("bin", err); }
async function purge(fd: FormData) { "use server"; const err = await purgeResource(await actor(), String(fd.get("id"))); revalidatePath("/resources"); go("bin", err); }
async function copy(fd: FormData) { "use server"; const r = await copyModule(await actor(), { programmeId: String(fd.get("fromP")), module: String(fd.get("fromM") ?? "") }, { programmeId: String(fd.get("toP")), module: String(fd.get("toM") ?? "") }); revalidatePath("/resources"); go("all", r); }
const pill = (s: string) => (s === "APPROVED" ? "ok" : s === "REJECTED" ? "bad" : "warn");

/** RES: learning resources library for staff: upload, search, my resources, review queue, recycle bin and module copy. */
export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ view?: string; e?: string; ok?: string; copied?: string }> }) {
  const me = await getSession(); if (!me || !AUTHORS.includes(me.role)) redirect("/dashboard"); const { t } = await getT(); const sp = await searchParams; const rev = REVIEWERS.includes(me.role);
  const view = ["all", "mine", "review", "bin"].includes(sp.view ?? "") ? sp.view! : "all";
  const base = rev ? {} : { OR: [{ ownerId: me.uid }, { status: "APPROVED" }] };
  const where = view === "bin" ? { deletedAt: { not: null }, ...(rev ? {} : { ownerId: me.uid }) } : view === "review" ? { deletedAt: null, status: "IN_REVIEW", ...(rev ? {} : { ownerId: me.uid }) } : view === "mine" ? { deletedAt: null, ownerId: me.uid } : { deletedAt: null, ...base };
  const [rs, progs, counts] = await Promise.all([db.resource.findMany({ where, include: { programme: { select: { name: true } }, owner: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 500 }), db.programme.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.resource.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true })]);
  const cnt = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const cols: Col[] = [{ key: "title", label: t("Title"), sortable: true }, { key: "programme", label: t("Programme"), filter: true }, { key: "module", label: t("Module"), filter: true }, { key: "kind", label: t("Type"), filter: true }, { key: "status", label: t("Status"), filter: true }, { key: "visibility", label: t("Who can see it"), filter: true }, { key: "owner", label: t("Uploaded by"), filter: true }, { key: "version", label: t("Version"), align: "right" }, { key: "views", label: t("Views"), sortable: true, align: "right", hidden: true }, { key: "downloads", label: t("Downloads"), sortable: true, align: "right", hidden: true }, { key: "tags", label: t("Tags"), hidden: true }, { key: "updated", label: t("Updated"), sortable: true }];
  const rows: Row[] = rs.map((r) => ({ id: r.id, v: { title: r.title, programme: r.programme?.name ?? t("Staff library"), module: r.module ?? "-", kind: t(label(r.kind)), status: t(label(r.status)), visibility: r.visibility === "STAFF" ? t("Staff only") : t("Students"), owner: r.owner.name, version: r.version, views: r.views, downloads: r.downloads, tags: r.tags.join(", "), updated: r.updatedAt.toISOString().slice(0, 10) },
    c: { title: <a href={`/resources/${r.id}`}>{r.title}</a>, status: <span className={`pill ${pill(r.status)}`}>{t(label(r.status))}{r.viewOnly ? " · " + t("View only") : ""}</span> } }));
  const tab = (k: string, l: string) => <a key={k} role="tab" aria-selected={view === k} className={view === k ? "btn s p" : "btn s"} href={`/resources?view=${k}`}>{l}</a>;
  return (<><div className="top"><div><h1>{t("Learning resources")}</h1><p>{t("Notes, slides, videos and exercises for each programme and module. Lecturers' uploads are reviewed by the academic office before students see them.")}</p></div></div>
    <div className="kpis"><div className="kpi"><span>{t("Approved")}</span><b>{cnt("APPROVED")}</b></div><div className="kpi"><span>{t("Waiting for review")}</span><b data-kpi="review">{cnt("IN_REVIEW")}</b></div><div className="kpi"><span>{t("Rejected")}</span><b>{cnt("REJECTED")}</b></div></div>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="ok" role="status">{t("Saved.")}</p>}{sp.copied && <p className="ok" role="status">{t("{n} resources copied.", { n: sp.copied })}</p>}
    <div className="grid2" style={{ marginBottom: 16 }}><ResourceUpload programmes={progs.map((p) => ({ value: p.id, label: p.name }))} kinds={KINDS.map((k) => ({ value: k, label: t(label(k)) }))} licences={[...LICENCES]} />
      {rev && <form className="panel" style={{ display: "grid", gap: 8, alignContent: "start" }} action={copy} id="copy-form"><h2 style={{ margin: 0 }}>{t("Copy a module")}</h2><p style={{ margin: 0, color: "var(--muted)" }}>{t("Copies every resource of a module to another programme or module, for example for a new course.")}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>{t("From programme")}<br /><select name="fromP">{progs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>{t("Module")}<br /><input name="fromM" required /></label></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>{t("To programme")}<br /><select name="toP">{progs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>{t("Module")}<br /><input name="toM" required /></label></div>
        <button type="submit" style={{ justifySelf: "start" }}>{t("Copy module")}</button></form>}</div>
    <div className="tabs" role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{[tab("all", t("All resources")), tab("mine", t("My resources")), tab("review", t("Review queue")), tab("bin", t("Recycle bin"))]}</div>
    {view === "review" && rev ? <div style={{ display: "grid", gap: 12 }}>{rs.length === 0 && <div className="panel empty">{t("Nothing is waiting for review.")}</div>}{rs.map((r) => <div className="panel" key={r.id} data-review={r.title}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><span><b><a href={`/resources/${r.id}`}>{r.title}</a></b> · {r.programme?.name ?? t("Staff library")} · {r.module ?? "-"} · v{r.version}</span><small>{r.owner.name}</small></div>
        <form style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}><input type="hidden" name="id" value={r.id} /><a className="btn s" href={`/api/resources/${r.id}`} target="_blank" rel="noopener">{t("Open")}</a><input name="note" placeholder={t("Comment (needed to reject)")} aria-label={t("Comment")} style={{ flex: 1, minWidth: 200 }} /><button className="p" formAction={review.bind(null, true)}>{t("Approve")}</button><button className="danger" formAction={review.bind(null, false)}>{t("Reject")}</button></form></div>)}</div>
    : view === "bin" ? <div className="panel"><p style={{ marginTop: 0, color: "var(--muted)" }}>{t("Deleted resources stay here for {n} days, then are removed for good.", { n: BIN_DAYS })}</p>{rs.length === 0 ? <p className="empty">{t("The recycle bin is empty.")}</p> : <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>{rs.map((r) => <li key={r.id} data-bin={r.title}><form style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><input type="hidden" name="id" value={r.id} /><b>{r.title}</b><small>{r.deletedBy} · {r.deletedAt?.toISOString().slice(0, 10)}</small><button className="s" formAction={restore}>{t("Restore")}</button>{rev && <button className="s danger" formAction={purge}>{t("Delete for good")}</button>}</form></li>)}</ul>}</div>
    : <div className="panel"><DataTable id={"res-" + view} cols={cols} rows={rows} exportName="resources" empty={t("No resources yet.")} /></div>}</>);
}
