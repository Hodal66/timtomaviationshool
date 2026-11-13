"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export type Due = { key: string; slotId: string; date: string; label: string; topics: string[]; done: string };
type Q = { slotId: string; date: string; topic: string; notes: string; issues: string };
const KEY = "tas_lesson_queue"; const rq = (): Q[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } }; const wq = (q: Q[]) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* ignore */ } };
const post = (body: object) => fetch("/api/teach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** LEC-13: one-tap lesson report; kept on the phone when offline and sent later. */
export function LessonReports({ due }: { due: Due[] }) {
  const t = useT(); const router = useRouter(); const [msg, setMsg] = useState(""); const [queued, setQueued] = useState(0); const [open, setOpen] = useState<string | null>(due.find((d) => !d.done)?.key ?? null);
  const flush = useCallback(async () => { const q = rq(); if (!q.length) return; const left: Q[] = []; for (const x of q) { try { const r = await post({ action: "report", ...x }); if (!r.ok && r.status >= 500) left.push(x); } catch { left.push(x); } } wq(left); setQueued(left.length); if (left.length < q.length) router.refresh(); }, [router]);
  useEffect(() => { setQueued(rq().length); flush(); addEventListener("online", flush); return () => removeEventListener("online", flush); }, [flush]);
  async function send(d: Due, f: FormData) { const x: Q = { slotId: d.slotId, date: d.date, topic: String(f.get("topic") || f.get("topicOther") || ""), notes: String(f.get("notes") ?? ""), issues: String(f.get("issues") ?? "") }; setMsg("");
    try { const r = await post({ action: "report", ...x }); const j = await r.json().catch(() => ({})); if (!r.ok) { setMsg(j.error ?? t("Something went wrong. Try again.")); return; } setMsg(t("Lesson report saved.")); setOpen(null); router.refresh(); }
    catch { const q = rq().filter((y) => !(y.slotId === x.slotId && y.date === x.date)); q.push(x); wq(q); setQueued(q.length); setMsg(t("No connection. The report is saved on this device and will be sent automatically.")); setOpen(null); } }
  return (<div className="panel" style={{ marginBottom: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><h2>{t("Lesson reports")}</h2>{queued > 0 && <span className="pill warn" role="status">{t("{n} waiting to send", { n: queued })}</span>}</div>
    {msg && <p role="status" id="lr-msg">{msg}</p>}{due.length === 0 && <p className="empty">{t("No classes in the last 7 days.")}</p>}
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>{due.map((d) => <li key={d.key} data-lesson={d.key} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><span><b>{d.label}</b></span>{d.done ? <span className="pill ok">{t("Reported")}: {d.done}</span> : <button className="s" onClick={() => setOpen(open === d.key ? null : d.key)}>{t("Report this lesson")}</button>}</div>
      {open === d.key && !d.done && <form style={{ display: "grid", gap: 8, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); send(d, new FormData(e.currentTarget)); }}>
        {d.topics.length > 0 && <><label htmlFor={"tp" + d.key}>{t("Topic covered")}</label><select id={"tp" + d.key} name="topic" defaultValue=""><option value="">{t("Choose from the syllabus")}</option>{d.topics.map((x) => <option key={x}>{x}</option>)}</select></>}
        <label htmlFor={"to" + d.key}>{d.topics.length ? t("Or write the topic") : t("Topic covered")}</label><input id={"to" + d.key} name="topicOther" />
        <input name="notes" placeholder={t("Short notes (optional)")} aria-label={t("Short notes (optional)")} /><input name="issues" placeholder={t("Issues to report (optional)")} aria-label={t("Issues to report (optional)")} /><button className="p" type="submit" style={{ justifySelf: "start" }}>{t("Save report")}</button></form>}</li>)}</ul></div>);
}
/** LEC-06: availability per day as time ranges. */
export function Availability({ days, initial }: { days: string[]; initial: Record<string, string[]> }) {
  const t = useT(); const router = useRouter(); const [msg, setMsg] = useState("");
  return (<form className="panel" style={{ display: "grid", gap: 8 }} onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const r = await post({ action: "availability", days: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [String(d), String(f.get("d" + d) ?? "")])) }); const j = await r.json().catch(() => ({})); setMsg(r.ok ? t("Saved.") : j.error); if (r.ok) router.refresh(); }}>
    <h2 style={{ marginBottom: 0 }}>{t("My availability")}</h2><p style={{ margin: 0, color: "var(--muted)" }}>{t("When you can teach, around your airport shifts. Example: 08:00-12:00, 14:00-17:00. Leave a day empty if you are not available.")}</p>
    {[1, 2, 3, 4, 5, 6, 7].map((d) => <label key={d} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, alignItems: "center" }}>{days[d]}<input name={"d" + d} defaultValue={(initial[String(d)] ?? []).join(", ")} aria-label={days[d]} /></label>)}
    {msg && <p role="status" id="av-msg">{msg}</p>}<button className="p" type="submit" style={{ justifySelf: "start" }}>{t("Save availability")}</button></form>);
}
/** LEC-16: ask for a substitute for one class on one date. */
export function Substitute({ classes }: { classes: { slotId: string; label: string; next: string }[] }) {
  const t = useT(); const router = useRouter(); const [msg, setMsg] = useState("");
  if (!classes.length) return null;
  return (<form className="panel" style={{ display: "grid", gap: 8 }} onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const r = await post({ action: "substitute", slotId: f.get("slotId"), date: f.get("date"), reason: f.get("reason") }); const j = await r.json().catch(() => ({})); setMsg(r.ok ? t("Request sent. The academic office will name a substitute.") : j.error); if (r.ok) { form.reset(); router.refresh(); } }}>
    <h2 style={{ marginBottom: 0 }}>{t("I cannot teach a class")}</h2><label htmlFor="sb-s">{t("Class")}</label><select id="sb-s" name="slotId">{classes.map((c) => <option key={c.slotId} value={c.slotId}>{c.label}</option>)}</select>
    <label htmlFor="sb-d">{t("Date")}</label><input id="sb-d" name="date" type="date" required defaultValue={classes[0].next} /><label htmlFor="sb-r">{t("Reason")}</label><input id="sb-r" name="reason" required minLength={5} />
    {msg && <p role="status" id="sb-msg">{msg}</p>}<button type="submit" style={{ justifySelf: "start" }}>{t("Ask for a substitute")}</button></form>);
}
