"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export type Portal = { enrolled: boolean; emergencyName: string; emergencyPhone: string; branchId: string; sessionCode: string; idUrl: string; idQr: string; photo: string; today: { time: string; subject: string; room: string }[]; nextDue: { ref: string; amount: string; due: string } | null; docs: { label: string; href: string }[]; zip: string; requests: { id: string; type: string; what: string; status: string; note: string; at: string }[] };
export type Services = { portal: Record<string, Portal>; branches: { id: string; name: string }[]; letterTypes: { k: string; label: string }[]; announcements: { id: string; title: string; body: string; at: string }[]; tickets: { id: string; applicantId: string; subject: string; category: string; status: string; rating: number | null; messages: { id: string; staff: boolean; author: string; body: string; at: string }[] }[] };
type App = { id: string; name: string; phone: string; programme: string; reference: string; branch: string; group: string };
const pill = (s: string) => (s === "APPROVED" || s === "ANSWERED" ? "ok" : s === "REJECTED" ? "bad" : "warn");

function usePost(say: (m: string) => void) { const router = useRouter(); const t = useT(); const [busy, setBusy] = useState(false);
  return { busy, post: async (body: object, okMsg: string) => { setBusy(true); try { const r = await fetch("/api/me/student", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) { say(j.error ?? t("Something went wrong. Try again.")); return false; } say(okMsg); router.refresh(); return true; } catch { say(t("Network problem. Check your connection and try again.")); return false; } finally { setBusy(false); } } }; }

/** STU-01: what matters today. */
export function TodayPanel({ app, p, s }: { app: App; p: Portal; s: Services }) { const t = useT();
  return (<div className="grid2" style={{ marginBottom: 16 }}>
    <div className="panel"><h2>{t("Today")}</h2>{p.today.length ? <ul className="tl">{p.today.map((c, i) => <li key={i}><b>{c.time}</b> {c.subject} <small>· {c.room}</small></li>)}</ul> : <p style={{ margin: 0, color: "var(--muted)" }}>{p.enrolled ? t("No classes today.") : t("Your classes appear here once you are enrolled.")}</p>}
      {p.nextDue && <p style={{ margin: "12px 0 0" }}><b>{t("Next payment")}:</b> {p.nextDue.amount}{p.nextDue.due ? ` · ${t("due")} ${p.nextDue.due}` : ""} <small style={{ color: "var(--muted)" }}>({p.nextDue.ref})</small></p>}</div>
    <div className="panel"><h2>{t("Announcements")}</h2>{s.announcements.length ? <ul className="tl">{s.announcements.map((n) => <li key={n.id}><b>{n.title}</b> <small>{n.at}</small><div style={{ whiteSpace: "pre-wrap" }} data-notranslate>{n.body}</div></li>)}</ul> : <p style={{ margin: 0, color: "var(--muted)" }}>{t("No announcements.")}</p>}</div></div>);
}
/** STU-05: instant downloads. */
export function DocDownloads({ p }: { p: Portal }) { const t = useT(); if (!p.docs.length) return null;
  return (<div className="panel" style={{ marginBottom: 16 }}><h2>{t("Official documents")}</h2><p style={{ margin: "0 0 10px", color: "var(--muted)" }}>{t("Each document carries a code and QR so that an employer or embassy can verify it with the School.")}</p>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{p.docs.map((d) => <a key={d.href} className="s" style={{ padding: "6px 12px", border: "1px solid var(--line)", borderRadius: 10, textDecoration: "none" }} href={d.href}>↓ {d.label}</a>)}<a className="btn-p" style={{ padding: "7px 14px", borderRadius: 10, textDecoration: "none" }} href={p.zip}>{t("Download everything (ZIP)")}</a></div></div>);
}
/** STU-12: digital ID card. */
export function IdCard({ app, p }: { app: App; p: Portal }) { const t = useT();
  if (!p.enrolled) return <div className="panel empty">{t("Your student ID card appears here once you are enrolled.")}</div>;
  return (<div style={{ display: "grid", justifyItems: "center", gap: 12 }}><div className="idcard" data-notranslate><div className="idcard-h"><b>Timtom Aviation School</b><small>{t("Student ID")}</small></div>
    <div className="idcard-b">{p.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.photo} alt="" width={84} height={84} /> : <div className="idcard-ph" aria-hidden>{app.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join("")}</div>}
      <div><b style={{ fontSize: 17 }}>{app.name}</b><div>{app.programme}</div><small>{app.branch}{app.group ? ` · ${app.group}` : ""}</small><div style={{ marginTop: 4 }}><small>{t("Reference")}</small> <b>{app.reference}</b></div></div></div>
    <div className="idcard-q" dangerouslySetInnerHTML={{ __html: p.idQr }} role="img" aria-label={t("QR code of your student ID")} /></div>
    <small style={{ color: "var(--muted)", textAlign: "center", maxWidth: 380 }}>{t("Show this card at the School. A lecturer can scan it to mark you present, and anyone scanning it sees that you are a current student.")}</small><button className="s" onClick={() => print()}>{t("Print")}</button></div>);
}
/** STU-02: contact details, emergency contact, photo. */
export function ProfileEditor({ app, p, say }: { app: App; p: Portal; say: (m: string) => void }) { const t = useT(); const { busy, post } = usePost(say); const router = useRouter(); const file = useRef<HTMLInputElement>(null);
  async function photo(f: File) { const fd = new FormData(); fd.append("applicantId", app.id); fd.append("file", f); const r = await fetch("/api/me/photo", { method: "POST", body: fd }); const j = await r.json().catch(() => ({})); say(r.ok ? t("Photo updated.") : j.error ?? t("Upload failed.")); if (r.ok) router.refresh(); }
  return (<form className="panel" style={{ display: "grid", gap: 8, maxWidth: 520, marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); post({ action: "profile", applicantId: app.id, phone: f.get("phone"), emergencyName: f.get("emergencyName"), emergencyPhone: f.get("emergencyPhone") }, t("Saved.")); }}>
    <h2 style={{ marginBottom: 0 }}>{t("Update my contact details")}</h2>
    <label htmlFor="pf-phone">{t("Phone")}</label><input id="pf-phone" name="phone" inputMode="tel" defaultValue={app.phone} />
    <label htmlFor="pf-en">{t("Emergency contact name")}</label><input id="pf-en" name="emergencyName" defaultValue={p.emergencyName} />
    <label htmlFor="pf-ep">{t("Emergency contact phone")}</label><input id="pf-ep" name="emergencyPhone" inputMode="tel" defaultValue={p.emergencyPhone} />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="p" type="submit" disabled={busy}>{t("Save")}</button><button type="button" onClick={() => file.current?.click()}>{p.photo ? t("Change my photo") : t("Add my photo")}</button></div>
    <input ref={file} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label={t("Choose a photo")} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) photo(f); }} />
    <small style={{ color: "var(--muted)" }}>{t("To correct your name or date of birth, send a request from the Requests tab. The School checks it against your documents.")}</small></form>);
}
/** STU-03, STU-06: requests that need approval. */
export function Requests({ app, p, s, say }: { app: App; p: Portal; s: Services; say: (m: string) => void }) { const t = useT(); const { busy, post } = usePost(say); const [type, setType] = useState("LETTER");
  if (!p.enrolled) return <div className="panel empty">{t("Requests are available once you are enrolled.")}</div>;
  return (<div className="grid2"><form className="panel" style={{ display: "grid", gap: 8 }} onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; const f = Object.fromEntries(new FormData(form)); if (await post({ action: "request", applicantId: app.id, ...f }, t("Request sent. You will be told when it is decided."))) form.reset(); }}>
      <h2 style={{ marginBottom: 0 }}>{t("New request")}</h2>
      <label htmlFor="rq-type">{t("What do you need?")}</label><select id="rq-type" name="type" value={type} onChange={(e) => setType(e.target.value)}><option value="LETTER">{t("An official letter")}</option><option value="SESSION_CHANGE">{t("Change my schedule or branch")}</option><option value="PROFILE_CHANGE">{t("Correct my name or date of birth")}</option></select>
      {type === "LETTER" && <><label htmlFor="rq-letter">{t("Kind of letter")}</label><select id="rq-letter" name="letter">{s.letterTypes.map((l) => <option key={l.k} value={l.k}>{l.label}</option>)}</select><label htmlFor="rq-to">{t("Addressed to (optional)")}</label><input id="rq-to" name="addressedTo" placeholder={t("To whom it may concern")} /></>}
      {type === "SESSION_CHANGE" && <><label htmlFor="rq-s">{t("Schedule")}</label><select id="rq-s" name="session" defaultValue={p.sessionCode}><option value="WEEKDAY">{t("Weekday")}</option><option value="WEEKEND">{t("Weekend")}</option></select><label htmlFor="rq-b">{t("Branch")}</label><select id="rq-b" name="branchId" defaultValue={p.branchId}>{s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></>}
      {type === "PROFILE_CHANGE" && <><label htmlFor="rq-n">{t("Correct full name")}</label><input id="rq-n" name="fullName" /><label htmlFor="rq-d">{t("Correct date of birth")}</label><input id="rq-d" name="dob" type="date" /></>}
      <label htmlFor="rq-r">{t("Reason")}</label><textarea id="rq-r" name="reason" rows={3} required /><button className="p" type="submit" disabled={busy} style={{ justifySelf: "start" }}>{t("Send request")}</button></form>
    <div className="panel"><h2>{t("My requests")}</h2>{p.requests.length === 0 ? <p className="empty">{t("Nothing yet.")}</p> : <ul className="tl">{p.requests.map((r) => <li key={r.id}><b>{r.what}</b> <span className={`pill ${pill(r.status)}`}>{r.status === "PENDING" ? t("Waiting for a decision") : r.status === "APPROVED" ? t("Approved") : t("Not approved")}</span> <small>{r.at}</small>{r.note && <div data-notranslate>{r.note}</div>}
      {r.type === "LETTER" && r.status === "APPROVED" && <div><a href={`/api/me/doc?a=${app.id}&kind=letter&id=${r.id}`}>{t("Download")}</a></div>}</li>)}</ul>}</div></div>);
}
/** STU-11: help requests with replies and a rating. */
export function Support({ app, s, say }: { app: App; s: Services; say: (m: string) => void }) { const t = useT(); const { busy, post } = usePost(say); const mine = s.tickets.filter((k) => k.applicantId === app.id);
  return (<div className="grid2"><form className="panel" style={{ display: "grid", gap: 8, alignContent: "start" }} onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; const f = Object.fromEntries(new FormData(form)); if (await post({ action: "ticket", applicantId: app.id, ...f }, t("Your question was sent."))) form.reset(); }}>
      <h2 style={{ marginBottom: 0 }}>{t("Ask for help")}</h2><label htmlFor="tk-c">{t("About")}</label><select id="tk-c" name="category">{["General", "Admissions", "Finance", "Academic", "Technical"].map((c) => <option key={c} value={c}>{t(c)}</option>)}</select>
      <label htmlFor="tk-s">{t("Subject")}</label><input id="tk-s" name="subject" required minLength={4} maxLength={140} /><label htmlFor="tk-b">{t("Your question")}</label><textarea id="tk-b" name="body" rows={4} required minLength={4} /><button className="p" type="submit" disabled={busy} style={{ justifySelf: "start" }}>{t("Send")}</button></form>
    <div style={{ display: "grid", gap: 12, alignContent: "start" }}>{mine.length === 0 && <div className="panel empty">{t("You have not asked anything yet.")}</div>}{mine.map((k) => <div className="panel" key={k.id} data-ticket={k.id}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b data-notranslate>{k.subject}</b><span className={`pill ${pill(k.status)}`}>{k.status === "OPEN" ? t("Waiting for an answer") : k.status === "ANSWERED" ? t("Answered") : `${t("Closed")}${k.rating ? ` · ${k.rating}/5` : ""}`}</span></div>
      <ul className="tl" style={{ margin: "10px 0" }}>{k.messages.map((m) => <li key={m.id}><small>{m.author} · {m.at}</small><div style={{ whiteSpace: "pre-wrap" }} data-notranslate>{m.body}</div></li>)}</ul>
      {k.status !== "CLOSED" && <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }} onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; if (await post({ action: "reply", applicantId: app.id, ticketId: k.id, body: new FormData(form).get("body") }, t("Sent."))) form.reset(); }}><input name="body" required aria-label={t("Reply")} placeholder={t("Reply")} style={{ flex: 1, minWidth: 160 }} /><button className="s" type="submit" disabled={busy}>{t("Send")}</button></form>}
      {k.status === "ANSWERED" && <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }} role="group" aria-label={t("Rate the answer")}><small>{t("Did this answer help? Rate it to close:")}</small>{[1, 2, 3, 4, 5].map((n) => <button key={n} className="s" aria-label={t("{n} out of 5", { n })} disabled={busy} onClick={() => post({ action: "rate", applicantId: app.id, ticketId: k.id, rating: n }, t("Thank you for your rating."))}>{n}★</button>)}</div>}</div>)}</div></div>);
}
