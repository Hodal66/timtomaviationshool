import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { label } from "@/lib/format";
import { AUTHORS, REVIEWERS, KINDS, LICENCES, staffCanSee, updateResource, reviewResource, trashResource, restoreResource } from "@/lib/resources";
import { ResourceUpload } from "@/components/ResourceUpload";
export const dynamic = "force-dynamic";
const actor = async () => { const s = await getSession(); if (!s || !AUTHORS.includes(s.role)) throw new Error("Not allowed"); return { uid: s.uid, name: s.name, role: s.role }; };
const back = (id: string, err: string | null) => redirect(`/resources/${id}?` + (err ? "e=" + encodeURIComponent(err) : "ok=1"));
const F = ["title", "description", "programmeId", "module", "topic", "kind", "tags", "language", "visibility", "releaseAt", "expiresAt", "licence", "viewOnly"];
async function save(fd: FormData) { "use server"; const id = String(fd.get("id")); const err = await updateResource(await actor(), id, Object.fromEntries(F.map((k) => [k, String(fd.get(k) ?? "")]))); revalidatePath("/resources"); back(id, err); }
async function review(approve: boolean, fd: FormData) { "use server"; const id = String(fd.get("id")); const err = await reviewResource(await actor(), id, approve, String(fd.get("note") ?? "")); revalidatePath("/resources"); back(id, err); }
async function trash(fd: FormData) { "use server"; const id = String(fd.get("id")); const err = await trashResource(await actor(), id); revalidatePath("/resources"); if (err) back(id, err); redirect("/resources?view=bin&ok=1"); }
async function restore(fd: FormData) { "use server"; const id = String(fd.get("id")); const err = await restoreResource(await actor(), id); revalidatePath("/resources"); back(id, err); }
const d10 = (d: Date | null) => d?.toISOString().slice(0, 10) ?? "";

/** RES: one resource: metadata, versions, review and recycle bin. */
export default async function ResourcePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; ok?: string }> }) {
  const me = await getSession(); if (!me || !AUTHORS.includes(me.role)) redirect("/dashboard"); const { t } = await getT(); const sp = await searchParams; const a = { uid: me.uid, name: me.name, role: me.role };
  const r = await db.resource.findUnique({ where: { id: (await params).id }, include: { programme: { select: { name: true } }, owner: { select: { name: true } }, versions: { select: { version: true, filename: true, mime: true, size: true, url: true, note: true, uploadedBy: true, createdAt: true }, orderBy: { version: "desc" } } } });
  if (!r || !staffCanSee(a, r)) notFound(); const can = REVIEWERS.includes(me.role) || r.ownerId === me.uid; const rev = REVIEWERS.includes(me.role);
  const progs = await db.programme.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return (<><div className="top"><div><h1>{r.title}</h1><p>{r.programme?.name ?? t("Staff library")} · {r.module ?? "-"} · <span className={`pill ${r.status === "APPROVED" ? "ok" : r.status === "REJECTED" ? "bad" : "warn"}`} id="res-status">{t(label(r.status))}</span>{r.deletedAt && <> · <span className="pill bad">{t("In the recycle bin")}</span></>}</p></div><a href="/resources">{t("Back to resources")}</a></div>
    {sp.e && <p className="err" role="alert">{sp.e}</p>}{sp.ok && <p className="ok" role="status">{t("Saved.")}</p>}{r.reviewNote && <p className="note">{t("Review comment")}: {r.reviewNote} ({r.reviewedBy})</p>}
    <div className="grid2" style={{ marginBottom: 16 }}>
      {can && !r.deletedAt ? <form className="panel" style={{ display: "grid", gap: 8 }} action={save} id="meta-form"><h2 style={{ margin: 0 }}>{t("Details")}</h2><input type="hidden" name="id" value={r.id} />
        <label htmlFor="rm-t">{t("Title")}</label><input id="rm-t" name="title" defaultValue={r.title} required />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>{t("Programme")}<br /><select name="programmeId" defaultValue={r.programmeId ?? ""}><option value="">{t("No programme (staff library)")}</option>{progs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>{t("Module")}<br /><input name="module" defaultValue={r.module ?? ""} /></label><label>{t("Topic")}<br /><input name="topic" defaultValue={r.topic ?? ""} /></label>
          <label>{t("Type")}<br /><select name="kind" defaultValue={r.kind}>{KINDS.map((k) => <option key={k} value={k}>{t(label(k))}</option>)}</select></label></div>
        <label htmlFor="rm-d">{t("Description")}</label><textarea id="rm-d" name="description" rows={2} defaultValue={r.description ?? ""} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>{t("Tags (comma separated)")}<br /><input name="tags" defaultValue={r.tags.join(", ")} /></label><label>{t("Language")}<br /><select name="language" defaultValue={r.language}><option value="en">English</option><option value="fr">Français</option><option value="rw">Kinyarwanda</option><option value="sw">Kiswahili</option></select></label>
          <label>{t("Who can see it")}<br /><select name="visibility" defaultValue={r.visibility}><option value="STUDENTS">{t("Students of the programme")}</option><option value="STAFF">{t("Staff only")}</option></select></label></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>{t("Release on")}<br /><input type="date" name="releaseAt" defaultValue={d10(r.releaseAt)} /></label><label>{t("Expires on")}<br /><input type="date" name="expiresAt" defaultValue={d10(r.expiresAt)} /></label><label>{t("Licence")}<br /><select name="licence" defaultValue={r.licence}>{LICENCES.map((l) => <option key={l} value={l}>{t(l)}</option>)}</select></label></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="viewOnly" defaultChecked={r.viewOnly} /> {t("View only: students can open it in the browser but not download it")}</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="p" type="submit">{t("Save details")}</button><button className="danger" formAction={trash}>{t("Move to recycle bin")}</button></div>
        {!rev && r.status === "APPROVED" && <small style={{ color: "var(--muted)" }}>{t("Saving changes sends the resource back for review.")}</small>}</form>
      : <div className="panel"><h2>{t("Details")}</h2><p>{r.description}</p><p><small>{t(label(r.kind))} · {t(r.licence)} · {r.tags.join(", ")}</small></p>{r.deletedAt && can && <form action={restore}><input type="hidden" name="id" value={r.id} /><button className="p">{t("Restore")}</button></form>}</div>}
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        {rev && !r.deletedAt && r.status !== "APPROVED" && <form className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><h2 style={{ width: "100%", margin: 0 }}>{t("Review")}</h2><input type="hidden" name="id" value={r.id} /><input name="note" placeholder={t("Comment (needed to reject)")} aria-label={t("Comment")} style={{ flex: 1, minWidth: 200 }} /><button className="p" formAction={review.bind(null, true)}>{t("Approve")}</button><button className="danger" formAction={review.bind(null, false)}>{t("Reject")}</button></form>}
        <div className="panel"><h2>{t("Versions")}</h2><ul className="tl" id="versions">{r.versions.map((v) => <li key={v.version}><b>v{v.version}</b> · {v.createdAt.toISOString().slice(0, 10)} · {v.uploadedBy} · {v.url ? t("Link") : `${v.filename} (${Math.ceil((v.size ?? 0) / 1024)} KB)`}{v.note ? ` · ${v.note}` : ""} · <a href={`/api/resources/${r.id}?v=${v.version}`} target="_blank" rel="noopener">{t("Open")}</a>{!v.url && <> · <a href={`/api/resources/${r.id}?v=${v.version}&dl=1`} download>{t("Download")}</a></>}</li>)}</ul>
          <small style={{ color: "var(--muted)" }}>{t("Views")}: {r.views} · {t("Downloads")}: {r.downloads} · {t("Uploaded by")}: {r.owner.name}</small></div>
        {can && !r.deletedAt && <ResourceUpload id={r.id} />}</div></div></>);
}
