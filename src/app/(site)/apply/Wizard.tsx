"use client";
import { useState } from "react";
import { submitApplication } from "./actions";

type Off = { id: string; label: string; seatsLeft: number; accepting: boolean };
const STEPS = ["Your details", "Study preferences", "Documents", "Review"];

export function Wizard({ course, courseName, offerings, offering, docs, err }: { course: string; courseName: string; offerings: Off[]; offering: string; docs: string[]; err?: string }) {
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Record<string, string>>({ offering });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const minor = v.dob ? (Date.now() - +new Date(v.dob)) / (365.25 * 864e5) < 18 : false;
  const chosen = offerings.find((o) => o.id === v.offering);
  const ok0 = v.fullName && (v.email || v.phone) && v.dob && (!minor || (v.guardianName && v.guardianPhone));
  const ok1 = !!chosen?.accepting;
  const hidden = (k: string) => <input type="hidden" name={k} value={v[k] ?? ""} />;
  return (<form action={submitApplication} className="form">
    <div className="steps" aria-label="Progress">{STEPS.map((s, i) => <b key={s} className={i === step ? "on" : ""}>{i + 1}. {s}</b>)}</div>
    <input type="hidden" name="course" value={course} />
    {["fullName", "email", "phone", "dob", "guardianName", "guardianPhone", "offering"].map(hidden)}
    {err && <p className="err" role="alert">{err}</p>}
    {step === 0 && <>
      <p>Applying for <b>{courseName}</b></p>
      <label htmlFor="fullName">Full name</label><input id="fullName" value={v.fullName ?? ""} onChange={set("fullName")} autoComplete="name" />
      <label htmlFor="phone">Phone (WhatsApp if possible)</label><input id="phone" value={v.phone ?? ""} onChange={set("phone")} inputMode="tel" autoComplete="tel" />
      <label htmlFor="email">Email</label><input id="email" type="email" value={v.email ?? ""} onChange={set("email")} autoComplete="email" />
      <label htmlFor="dob">Date of birth</label><input id="dob" type="date" value={v.dob ?? ""} onChange={set("dob")} />
      {minor && <div className="notice"><b>Under 18.</b> A parent or guardian must be linked before admission.
        <label htmlFor="guardianName">Guardian name</label><input id="guardianName" value={v.guardianName ?? ""} onChange={set("guardianName")} />
        <label htmlFor="guardianPhone">Guardian phone</label><input id="guardianPhone" value={v.guardianPhone ?? ""} onChange={set("guardianPhone")} inputMode="tel" /></div>}
      <button type="button" className="btn" disabled={!ok0} onClick={() => setStep(1)}>Continue</button>
    </>}
    {step === 1 && <>
      <label htmlFor="offering">Intake, branch and schedule</label>
      <select id="offering" value={v.offering ?? ""} onChange={set("offering")}>
        <option value="">Choose one</option>
        {offerings.map((o) => <option key={o.id} value={o.id} disabled={!o.accepting}>{o.label}{o.accepting ? ` (${o.seatsLeft} seats left)` : " (not available)"}</option>)}
      </select>
      <div><button type="button" className="btn alt" onClick={() => setStep(0)} style={{ color: "var(--fg)" }}>Back</button> <button type="button" className="btn" disabled={!ok1} onClick={() => setStep(2)}>Continue</button></div>
    </>}
    {step === 2 && <>
      <p>Admissions will ask for these documents after you submit. You can hand them in at the branch or send them as instructed in your confirmation.</p>
      <ul className="ol">{docs.map((d) => <li key={d}>{d}</li>)}</ul>
      <div className="notice">Online upload is not switched on yet. Your application records which documents are still needed, and staff mark them as received.</div>
      <div><button type="button" className="btn alt" onClick={() => setStep(1)} style={{ color: "var(--fg)" }}>Back</button> <button type="button" className="btn" onClick={() => setStep(3)}>Continue</button></div>
    </>}
    {step === 3 && <>
      <table><tbody>
        <tr><td>Course</td><td>{courseName}</td></tr><tr><td>Name</td><td>{v.fullName}</td></tr><tr><td>Phone</td><td>{v.phone || "-"}</td></tr><tr><td>Email</td><td>{v.email || "-"}</td></tr>
        <tr><td>Intake</td><td style={{ whiteSpace: "normal" }}>{chosen?.label}</td></tr></tbody></table>
      <div><button type="button" className="btn alt" onClick={() => setStep(2)} style={{ color: "var(--fg)" }}>Back</button> <button type="submit" className="btn acc">Submit application</button></div>
    </>}
  </form>);
}
