"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

type Opt = { value: string; label: string };
/** RES: upload form (file or link + metadata), or a new version when `id` is given. */
export function ResourceUpload({ id, programmes, kinds, licences }: { id?: string; programmes?: Opt[]; kinds?: Opt[]; licences?: string[] }) {
  const t = useT(); const router = useRouter(); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  return (<form className="panel" style={{ display: "grid", gap: 8 }} id={id ? "version-form" : "upload-form"} onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); if (id) f.set("id", id); setBusy(true); setMsg("");
      try { const r = await fetch("/api/resources", { method: "POST", body: f }); const j = await r.json().catch(() => ({})); if (!r.ok) setMsg(j.error ?? t("Something went wrong. Try again.")); else { form.reset(); setMsg(id ? t("New version saved.") : t("Resource saved.")); router.refresh(); } } catch { setMsg(t("No connection. Try again.")); } setBusy(false); }}>
    <h2 style={{ margin: 0 }}>{id ? t("Upload a new version") : t("Add a resource")}</h2>
    {!id && <><label htmlFor="ru-t">{t("Title")}</label><input id="ru-t" name="title" required minLength={3} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>{t("Programme")}<br /><select name="programmeId" defaultValue=""><option value="">{t("No programme (staff library)")}</option>{programmes!.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label>{t("Module")}<br /><input name="module" /></label><label>{t("Topic")}<br /><input name="topic" /></label><label>{t("Type")}<br /><select name="kind">{kinds!.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label></div>
      <label htmlFor="ru-d">{t("Description")}</label><textarea id="ru-d" name="description" rows={2} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>{t("Tags (comma separated)")}<br /><input name="tags" /></label><label>{t("Language")}<br /><select name="language"><option value="en">English</option><option value="fr">Français</option><option value="rw">Kinyarwanda</option><option value="sw">Kiswahili</option></select></label>
        <label>{t("Who can see it")}<br /><select name="visibility"><option value="STUDENTS">{t("Students of the programme")}</option><option value="STAFF">{t("Staff only")}</option></select></label></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>{t("Release on")}<br /><input type="date" name="releaseAt" /></label><label>{t("Expires on")}<br /><input type="date" name="expiresAt" /></label>
        <label>{t("Licence")}<br /><select name="licence">{licences!.map((l) => <option key={l} value={l}>{t(l)}</option>)}</select></label></div>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="viewOnly" /> {t("View only: students can open it in the browser but not download it")}</label></>}
    <label htmlFor={id ? "rv-f" : "ru-f"}>{t("File (PDF, Word, PowerPoint, Excel, image, MP4 or MP3, up to 4 MB)")}</label><input id={id ? "rv-f" : "ru-f"} name="file" type="file" />
    <label htmlFor={id ? "rv-u" : "ru-u"}>{t("Or a link (for example a video on YouTube or Google Drive)")}</label><input id={id ? "rv-u" : "ru-u"} name="url" type="url" placeholder="https://" />
    {id && <><label htmlFor="rv-n">{t("What changed")}</label><input id="rv-n" name="note" /></>}
    {msg && <p role="status" id={id ? "rv-msg" : "ru-msg"}>{msg}</p>}<button className="p" type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? t("Saving...") : id ? t("Save new version") : t("Save resource")}</button></form>);
}
