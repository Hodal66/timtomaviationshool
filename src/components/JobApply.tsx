"use client";
import { useState } from "react";

/** LEC-08: application form with CV upload (PDF or DOCX, up to 4 MB) and one yes/no question per requirement. */
export function JobApply({ slug, requirements }: { slug: string; requirements: string[] }) {
  const [err, setErr] = useState(""); const [ref, setRef] = useState(""); const [busy, setBusy] = useState(false);
  if (ref) return <div className="note" role="status" id="job-done"><b>Thank you.</b> Your application reference is <b>{ref}</b>. We will contact you if you are shortlisted.</div>;
  return (<form className="vstack" style={{ gap: 14 }} noValidate onSubmit={async (e) => { e.preventDefault(); setErr(""); const f = new FormData(e.currentTarget); const cv = f.get("cv");
      if (!(cv instanceof File) || !cv.size) { setErr("Attach your CV."); return; } if (cv.size > 4 * 1024 * 1024) { setErr("The CV is larger than 4 MB."); return; }
      f.set("slug", slug); setBusy(true); try { const r = await fetch("/api/careers/apply", { method: "POST", body: f }); const j = await r.json().catch(() => ({})); if (r.ok) setRef(j.reference); else setErr(j.error ?? "Something went wrong. Try again."); } catch { setErr("No connection. Try again."); } setBusy(false); }}>
    <div className="field"><label htmlFor="ja-n">Full name</label><input id="ja-n" name="fullName" required autoComplete="name" /></div>
    <div className="field"><label htmlFor="ja-e">Email</label><input id="ja-e" name="email" type="email" required autoComplete="email" /></div>
    <div className="field"><label htmlFor="ja-p">Phone</label><input id="ja-p" name="phone" type="tel" required autoComplete="tel" /></div>
    {requirements.length > 0 && <fieldset style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}><legend>Do you meet these requirements?</legend>
      {requirements.map((r, i) => <div key={r} style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", padding: "4px 0", flexWrap: "wrap" }}><span>{r}</span><span style={{ display: "flex", gap: 12 }}>
        <label><input type="radio" name={`q${i}`} value="yes" required /> Yes</label><label><input type="radio" name={`q${i}`} value="no" defaultChecked /> No</label></span></div>)}</fieldset>}
    <div className="field"><label htmlFor="ja-cv">CV (PDF or Word, up to 4 MB)</label><input id="ja-cv" name="cv" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></div>
    <div className="field"><label htmlFor="ja-c">Why do you want to teach with us? (optional)</label><textarea id="ja-c" name="coverNote" rows={4} maxLength={2000} /></div>
    <p style={{ margin: 0, fontSize: ".9rem", color: "var(--muted)" }}>We use your details only to assess this application and delete unsuccessful applications after 12 months.</p>
    {err && <p className="err" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{err}</p>}
    <button className="btn pri" type="submit" disabled={busy}>{busy ? "Sending..." : "Send application"}</button></form>);
}
