"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DOC_KINDS, EDU_LEVELS, MAX_UPLOAD, UPLOAD_MIME, ageOf, validate, type ApplyData, type Errors } from "@/lib/apply";

export type WProgramme = { slug: string; name: string; offerings: { id: string; intake: string; branch: string; session: string; seatsLeft: number; deadline: string | null; accepting: boolean }[] };
const STEPS = ["Programme", "Your details", "Education", "Documents", "Review"] as const;
const STEP_OF: Partial<Record<keyof ApplyData, number>> = { course: 0, offering: 0, fullName: 1, phone: 1, email: 1, dob: 1, guardianName: 1, guardianPhone: 1, educationLevel: 2, institution: 2, completionYear: 2 };
type Save = "idle" | "saving" | "saved" | "error";
type Up = Record<string, { filename: string; size: number } | undefined>;

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1.2 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function Wizard({ programmes, initial }: { programmes: WProgramme[]; initial: { course?: string; offering?: string; draft?: string } }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<ApplyData>({ course: initial.course, offering: initial.offering });
  const [errors, setErrors] = useState<Errors>({});
  const [token, setToken] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Up>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [upErr, setUpErr] = useState<Record<string, string>>({});
  const [save, setSave] = useState<Save>("idle");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [agree, setAgree] = useState(false);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [ref, setRef] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const head = useRef<HTMLHeadingElement>(null);
  const tokenRef = useRef<string | null>(null); tokenRef.current = token;

  // Restore a saved draft (link or this browser), but let the URL choose the programme.
  useEffect(() => {
    (async () => {
      let t = initial.draft; try { t = t || localStorage.getItem("tas_draft") || undefined; } catch { /* storage unavailable */ }
      if (t) {
        const r = await fetch(`/api/apply/draft?token=${encodeURIComponent(t)}`).catch(() => null);
        if (r?.ok) {
          const d = await r.json(); setToken(t);
          setData({ ...d.data, ...(initial.course ? { course: initial.course, offering: initial.offering ?? (d.data.course === initial.course ? d.data.offering : undefined) } : {}) });
          setStep(Math.min(Number(d.step) || 0, 4)); setUploads(Object.fromEntries((d.uploads as { kind: string; filename: string; size: number }[]).map((u) => [u.kind, { filename: u.filename, size: u.size }])));
        }
      }
      setReady(true);
    })();
  }, [initial.draft, initial.course, initial.offering]);

  const persist = useCallback(async (d: ApplyData, s: number) => {
    setSave("saving");
    try {
      const r = await fetch("/api/apply/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: tokenRef.current, data: d, step: s }) });
      if (!r.ok) throw new Error();
      const { token: t } = await r.json(); setToken(t); tokenRef.current = t; try { localStorage.setItem("tas_draft", t); } catch { /* ignore */ }
      setSave("saved"); return t as string;
    } catch { setSave("error"); return null; }
  }, []);
  useEffect(() => { if (!ready || ref) return; const id = setTimeout(() => { if (Object.values(data).some(Boolean)) persist(data, step); }, 700); return () => clearTimeout(id); }, [data, step, ready, ref, persist]);

  const set = (k: keyof ApplyData, v: string) => { setData((d) => ({ ...d, [k]: v, ...(k === "course" ? { offering: undefined } : {}) })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const go = (n: number) => { if (n > step) setSubmitErr(""); setStep(n); setTimeout(() => { head.current?.focus(); scrollTo({ top: 0, behavior: "smooth" }); }, 30); };
  const focusField = (k: string) => setTimeout(() => document.getElementById(`f-${k}`)?.focus(), 40);
  const next = () => {
    const which = (["programme", "details", "education"] as const)[step];
    if (which) { const e = validate(data, which); setErrors(e); const f = Object.keys(e)[0]; if (f) { focusField(f); return; } }
    go(step + 1);
  };

  const prog = programmes.find((p) => p.slug === data.course);
  const age = ageOf(data.dob), minor = !Number.isNaN(age) && age < 18;
  const chosen = prog?.offerings.find((o) => o.id === data.offering);

  async function upload(kind: string, f: File | undefined) {
    if (!f) return;
    setUpErr((e) => ({ ...e, [kind]: "" }));
    if (!UPLOAD_MIME.includes(f.type)) return setUpErr((e) => ({ ...e, [kind]: "Upload a JPG, PNG, WebP or PDF file." }));
    setBusy(kind);
    try {
      const file = await shrink(f);
      if (file.size > MAX_UPLOAD) throw new Error("That file is larger than 4 MB. Take a smaller photo or compress the PDF.");
      const t = tokenRef.current ?? (await persist(data, step)); if (!t) throw new Error("Could not save your draft. Check your connection and try again.");
      const fd = new FormData(); fd.set("token", t); fd.set("kind", kind); fd.set("file", file);
      const r = await fetch("/api/apply/upload", { method: "POST", body: fd }); const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload failed.");
      setUploads((u) => ({ ...u, [kind]: { filename: j.filename, size: j.size } }));
    } catch (e) { setUpErr((x) => ({ ...x, [kind]: e instanceof Error ? e.message : "Upload failed." })); }
    setBusy(null);
  }
  async function remove(kind: string) { if (!token) return; await fetch(`/api/apply/upload?token=${encodeURIComponent(token)}&kind=${encodeURIComponent(kind)}`, { method: "DELETE" }); setUploads((u) => ({ ...u, [kind]: undefined })); }

  async function submit() {
    const e = validate(data, "all"); const f = Object.keys(e)[0] as keyof ApplyData | undefined;
    if (f) { setErrors(e); go(STEP_OF[f] ?? 0); focusField(f); return; }
    setSubmitting(true); setSubmitErr("");
    const t = await persist(data, step);
    if (!t) { setSubmitting(false); return setSubmitErr("Could not save your application. Check your connection and try again."); }
    const r = await fetch("/api/apply/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: t }) });
    const j = await r.json().catch(() => ({ ok: false, error: "Something went wrong. Please try again." }));
    setSubmitting(false);
    if (j.ok) { try { localStorage.removeItem("tas_draft"); } catch { /* ignore */ } setRef(j.reference); setTimeout(() => { head.current?.focus(); scrollTo({ top: 0, behavior: "smooth" }); }, 30); return; }
    setSubmitErr(j.error || "Something went wrong.");
    if (j.field === "offering" && data.offering) { setBlocked((b) => [...b, data.offering!]); setData((d) => ({ ...d, offering: undefined })); }
    if (j.field) go(STEP_OF[j.field as keyof ApplyData] ?? 0);
  }

  const resumeUrl = token && typeof location !== "undefined" ? `${location.origin}/apply?draft=${token}` : "";
  const fld = (k: keyof ApplyData, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div className="field"><label htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} name={k} value={data[k] ?? ""} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `e-${k}` : hint ? `h-${k}` : undefined} {...props} />
      {hint && !errors[k] && <span className="hint" id={`h-${k}`}>{hint}</span>}{errors[k] && <span className="err" id={`e-${k}`} role="alert">{errors[k]}</span>}</div>);

  if (ref) return (<div className="wz done" role="status">
    <div className="tick" aria-hidden="true"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg></div>
    <h2 ref={head} tabIndex={-1}>Application received</h2>
    <p className="lead" style={{ margin: 0 }}>Keep your reference. You need it, with your phone or email, to track your application.</p>
    <div className="ref" aria-label="Application reference">{ref}</div>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
      <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(ref).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "Copied" : "Copy reference"}</button>
      <a className="btn pri" href={`/track?ref=${ref}`}>Track my application</a></div>
    <p style={{ color: "var(--mute)", maxWidth: "50ch" }}>Admissions will review your application. Your status changes as documents are verified and payment is confirmed.</p>
  </div>);

  if (!ready) return <div className="wz" aria-busy="true"><div className="bar"><i /></div><p style={{ color: "var(--mute)" }}>Loading your application...</p></div>;

  return (<div className="wz">
    <div className="prog"><ol aria-hidden="true">{STEPS.map((s, i) => <li key={s} className={i < step ? "done" : i === step ? "on" : ""} />)}</ol>
      <div className="meta"><span>Step {step + 1} of {STEPS.length}: <b>{STEPS[step]}</b></span>
        <span className={`saved${save === "error" ? " err" : ""}`} role="status" aria-live="polite">{save === "saving" ? "Saving..." : save === "saved" ? "Progress saved" : save === "error" ? "Not saved. Check your connection." : "Saved automatically"}</span></div></div>

    {submitErr && <div className="note" role="alert" style={{ borderLeftColor: "var(--bad)", background: "#FFF5F4", color: "#7a1f19" }}><b>We could not submit your application.</b> {submitErr}</div>}
    <h2 ref={head} tabIndex={-1} style={{ fontSize: "clamp(1.4rem,1rem + 1.4vw,2rem)", outline: "none" }}>{["Choose your programme", "Tell us about you", "Your education", "Upload your documents", "Review and submit"][step]}</h2>

    {step === 0 && <>
      <div className="field"><label htmlFor="f-course">Programme</label>
        <select id="f-course" value={data.course ?? ""} onChange={(e) => set("course", e.target.value)} aria-invalid={!!errors.course}>
          <option value="">Select a programme</option>{programmes.map((p) => <option key={p.slug} value={p.slug}>{p.name}{p.offerings.some((o) => o.accepting) ? "" : " (no open intake)"}</option>)}</select>
        {errors.course && <span className="err" role="alert">{errors.course}</span>}</div>
      {prog && (prog.offerings.length === 0 ? <div className="note">No intake is open for <b>{prog.name}</b> right now. <a href="/contact">Contact admissions</a> to be told when one opens, or choose another programme.</div> :
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend>Intake, branch and schedule</legend>
          <div className="opts" role="radiogroup" aria-label="Intake">{prog.offerings.map((o) => (
            <label key={o.id} className="opt" aria-disabled={!o.accepting || blocked.includes(o.id)}><input type="radio" name="offering" value={o.id} checked={data.offering === o.id} disabled={!o.accepting || blocked.includes(o.id)} onChange={() => { setSubmitErr(""); set("offering", o.id); }} />
              <span><b>{o.intake}</b> · {o.branch}<small>{o.session === "WEEKDAY" ? "Weekday: Monday to Friday, three 2-hour sessions" : "Weekend: Saturday and Sunday, 9:00 AM to 2:00 PM"}</small></span>
              <span className={`pillx ${o.accepting && !blocked.includes(o.id) ? "ok" : "warn"}`}>{blocked.includes(o.id) ? "Full" : o.accepting ? `${o.seatsLeft} seats left` : o.seatsLeft === 0 ? "Full" : "Closed"}</span></label>))}</div>
          {errors.offering && <span className="err" role="alert">{errors.offering}</span>}</fieldset>)}
      <div className="nav2"><span /><button className="btn pri" onClick={next} disabled={!prog || prog.offerings.length === 0}>Continue</button></div>
    </>}

    {step === 1 && <>
      {fld("fullName", "Full name", { autoComplete: "name" })}
      <div className="cols2">{fld("phone", "Phone (WhatsApp if possible)", { inputMode: "tel", autoComplete: "tel", placeholder: "+250 7XX XXX XXX" })}{fld("email", "Email", { type: "email", autoComplete: "email" }, "Phone or email is enough. Both help us reach you.")}</div>
      {fld("dob", "Date of birth", { type: "date", max: new Date().toISOString().slice(0, 10), autoComplete: "bday" })}
      {minor && <div className="note"><b>You are under 18.</b> A parent or guardian must be linked to your application.
        <div className="cols2" style={{ marginTop: 14 }}>{fld("guardianName", "Guardian full name")}{fld("guardianPhone", "Guardian phone", { inputMode: "tel" })}</div></div>}
      <div className="nav2"><button className="btn ghost" onClick={() => go(0)}>Back</button><button className="btn pri" onClick={next}>Continue</button></div>
    </>}

    {step === 2 && <>
      <div className="field"><label htmlFor="f-educationLevel">Highest level completed</label>
        <select id="f-educationLevel" value={data.educationLevel ?? ""} onChange={(e) => set("educationLevel", e.target.value)} aria-invalid={!!errors.educationLevel}><option value="">Select one</option>{EDU_LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
        {errors.educationLevel && <span className="err" role="alert">{errors.educationLevel}</span>}</div>
      {fld("institution", "School or institution attended", { autoComplete: "organization" })}
      {fld("completionYear", "Year completed", { inputMode: "numeric", maxLength: 4, placeholder: "2024" })}
      <div className="nav2"><button className="btn ghost" onClick={() => go(1)}>Back</button><button className="btn pri" onClick={next}>Continue</button></div>
    </>}

    {step === 3 && <>
      <p className="lead" style={{ margin: 0 }}>Take a clear photo or choose a file. JPG, PNG, WebP or PDF, up to 4 MB each. You can skip this now and upload later from your tracking page.</p>
      <div className="upl">{DOC_KINDS.map((k) => { const u = uploads[k]; const id = `up-${k.replace(/\W+/g, "-")}`;
        return (<div key={k} className={`ur${u ? " ok" : ""}`}><div><b>{k}</b>
          {busy === k ? <><small>Uploading...</small><div className="bar"><i /></div></> : u ? <small><span className="st">Uploaded</span> · {u.filename} ({kb(u.size)})</small> : <small>Not uploaded yet</small>}
          {upErr[k] && <span className="err" role="alert" style={{ display: "block", color: "var(--bad)", fontSize: ".88rem" }}>{upErr[k]}</span>}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input id={id} type="file" accept="image/*,application/pdf" onChange={(e) => { upload(k, e.target.files?.[0]); e.target.value = ""; }} disabled={busy !== null} />
            <label htmlFor={id} className="btn ghost sm" role="button">{u ? "Replace" : "Choose file"}</label>
            {u && <button className="btn ghost sm" onClick={() => remove(k)} aria-label={`Remove ${k}`}>Remove</button>}</div></div>); })}</div>
      <div className="nav2"><button className="btn ghost" onClick={() => go(2)}>Back</button><button className="btn pri" onClick={() => go(4)} disabled={busy !== null}>Continue</button></div>
    </>}

    {step === 4 && <>
      <dl className="rv-list">
        <div><dt>Programme</dt><dd>{prog?.name}<br /><small style={{ color: "var(--mute)" }}>{chosen ? `${chosen.intake} · ${chosen.branch} · ${chosen.session === "WEEKDAY" ? "Weekday" : "Weekend"}` : ""}</small></dd><dd><button className="btn ghost sm" onClick={() => go(0)}>Change</button></dd></div>
        <div><dt>Name</dt><dd>{data.fullName}</dd><dd><button className="btn ghost sm" onClick={() => go(1)}>Change</button></dd></div>
        <div><dt>Contact</dt><dd>{[data.phone, data.email].filter(Boolean).join(" · ")}</dd><dd /></div>
        <div><dt>Date of birth</dt><dd>{data.dob}{minor && data.guardianName ? ` · Guardian: ${data.guardianName}` : ""}</dd><dd /></div>
        <div><dt>Education</dt><dd>{data.educationLevel}, {data.institution} ({data.completionYear})</dd><dd><button className="btn ghost sm" onClick={() => go(2)}>Change</button></dd></div>
        <div><dt>Documents</dt><dd>{DOC_KINDS.filter((k) => uploads[k]).length} of {DOC_KINDS.length} uploaded</dd><dd><button className="btn ghost sm" onClick={() => go(3)}>Change</button></dd></div>
      </dl>
      <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, accentColor: "var(--blue)" }} /><span>I confirm that the information I have given is correct.</span></label>
      <div className="nav2"><button className="btn ghost" onClick={() => go(3)}>Back</button><button className="btn cta" onClick={submit} disabled={!agree || submitting}>{submitting ? "Submitting..." : "Submit application"}</button></div>
    </>}

    {token && step > 0 && <p style={{ color: "var(--mute)", fontSize: ".9rem", margin: 0 }}>Want to finish later or on another device? <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => navigator.clipboard?.writeText(resumeUrl).then(() => setCopied(true)).catch(() => {})}>{copied ? "Link copied" : "Copy your resume link"}</button></p>}
  </div>);
}
