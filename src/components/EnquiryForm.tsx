"use client";
import { useActionState } from "react";
import { enquire, type EnquiryState } from "@/app/(site)/courses/[slug]/actions";

export function EnquiryForm({ programmeId, id = "enq" }: { programmeId?: string; id?: string }) {
  const [s, act, pending] = useActionState<EnquiryState, FormData>(enquire, null);
  if (s?.ok) return <div className="note" role="status"><b>Thank you.</b> Admissions has your question and will contact you.</div>;
  return (<form action={act} className="vstack" style={{ gap: 16 }} noValidate>
    {programmeId && <input type="hidden" name="programmeId" value={programmeId} />}
    <div className="field"><label htmlFor={`${id}-n`}>Your name</label><input id={`${id}-n`} name="name" required autoComplete="name" /></div>
    <div className="field"><label htmlFor={`${id}-c`}>Phone or email</label><input id={`${id}-c`} name="contact" required autoComplete="email" /></div>
    <div className="field"><label htmlFor={`${id}-m`}>Your question</label><textarea id={`${id}-m`} name="message" rows={3} /></div>
    {s?.error && <p className="err" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{s.error}</p>}
    <button className="btn pri" type="submit" disabled={pending}>{pending ? "Sending..." : "Send question"}</button>
  </form>);
}
