"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

/** VCL-04: upload the Google Meet attendance report for one session and show what was matched. */
export function MeetImport({ slotId, date }: { slotId: string; date: string }) {
  const t = useT(); const router = useRouter(); const [msg, setMsg] = useState(""); const [un, setUn] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  return (<form className="panel" style={{ display: "grid", gap: 8 }} id="meet-import" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); f.set("slotId", slotId); f.set("date", date); setBusy(true); setMsg(""); setUn([]);
      try { const r = await fetch("/api/online", { method: "POST", body: f }); const j = await r.json().catch(() => ({})); if (!r.ok) setMsg(j.error ?? t("Something went wrong. Try again.")); else { setMsg(t("Imported: {p} present, {l} late, {a} absent, {c} kept from campus.", { p: j.present, l: j.late, a: j.absent, c: j.campus })); setUn([...(j.unmatched ?? []), ...(j.warnings ?? [])]); router.refresh(); } } catch { setMsg(t("No connection. Try again.")); } setBusy(false); }}>
    <h2 style={{ margin: 0 }}>{t("Import Meet attendance")}</h2><p style={{ margin: 0, color: "var(--muted)" }}>{t("Upload the attendance report (CSV) that Google Meet emails to the organiser after the class. Students are matched by their School email, then their personal email.")}</p>
    <label htmlFor="mi-f">{t("Attendance report (CSV)")}</label><input id="mi-f" name="file" type="file" accept=".csv,text/csv" required />
    {msg && <p role="status" id="mi-msg" style={{ margin: 0 }}>{msg}</p>}{un.length > 0 && <div id="mi-un"><b>{t("Not matched to a student in this class")}:</b><ul>{un.map((x) => <li key={x}>{x}</li>)}</ul></div>}
    <button className="p" type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? t("Saving...") : t("Import report")}</button></form>);
}
