"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

type St = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
export type RollStudent = { id: string; name: string; status: St | null; rate: number | null; method: string | null };
type Pending = { slotId: string; date: string; marks: { applicantId: string; status: string }[]; at: number };
const KEY = "tas_att_queue";
const readQ = (): Pending[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const writeQ = (q: Pending[]) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* storage full or blocked */ } };

/** Roll-call that keeps working without a connection: marks are kept on the phone and sent when it is back online (ATT-02). */
export function RollCall({ slotId, date, students, title, live }: { slotId: string; date: string; students: RollStudent[]; title: string; live: boolean }) {
  const t = useT(); const router = useRouter(); const [marks, setMarks] = useState<Record<string, St>>(() => Object.fromEntries(students.map((s) => [s.id, s.status ?? "PRESENT"])));
  const [msg, setMsg] = useState(""); const [queued, setQueued] = useState(0); const [online, setOnline] = useState(true); const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ svg: string; present: number } | null>(null); const [showQr, setShowQr] = useState(false); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = (p: Pending, offline: boolean) => fetch("/api/attendance/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...p, offline }) });
  const flush = useCallback(async () => { const q = readQ(); if (!q.length) { setQueued(0); return; } const left: Pending[] = []; let ok = 0;
    for (const p of q) { try { const r = await send(p, true); if (r.ok || r.status === 400 || r.status === 403) ok += r.ok ? 1 : 0; else left.push(p); } catch { left.push(p); } }
    writeQ(left); setQueued(left.length); if (ok) { setMsg(t("{n} saved from this device.", { n: ok })); router.refresh(); } }, [router, t]);
  useEffect(() => { setOnline(navigator.onLine); setQueued(readQ().length); const on = () => { setOnline(true); flush(); }; const off = () => setOnline(false); addEventListener("online", on); addEventListener("offline", off); if (navigator.onLine) flush(); return () => { removeEventListener("online", on); removeEventListener("offline", off); }; }, [flush]);
  async function save() { setBusy(true); setMsg(""); const p: Pending = { slotId, date, marks: Object.entries(marks).map(([applicantId, status]) => ({ applicantId, status })), at: Date.now() };
    try { const r = await send(p, false); if (!r.ok) { const j = await r.json().catch(() => ({})); setMsg(j.error ?? t("Something went wrong. Try again.")); } else { setMsg(t("Saved")); router.refresh(); } }
    catch { const q = readQ().filter((x) => !(x.slotId === slotId && x.date === date)); q.push(p); writeQ(q); setQueued(q.length); setMsg(t("No connection. Saved on this device and will be sent automatically when you are back online.")); }
    finally { setBusy(false); } }
  const loadQr = useCallback(async () => { try { const r = await fetch(`/api/attendance/qr?slot=${slotId}`); if (r.ok) { const j = await r.json(); setQr({ svg: j.svg, present: j.present }); timer.current = setTimeout(loadQr, Math.max(1500, Math.min(j.expiresInMs + 300, 10000))); return; } } catch { /* retry below */ } timer.current = setTimeout(loadQr, 5000); }, [slotId]);
  useEffect(() => { if (showQr) loadQr(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [showQr, loadQr]);
  const all = (s: St) => setMarks(Object.fromEntries(students.map((x) => [x.id, s])));
  return (<div className="panel"><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}><h2 style={{ margin: 0 }}>{title}</h2>
      <span className={`pill ${online ? "ok" : "warn"}`} role="status">{online ? t("Online") : t("Offline")}{queued ? ` · ${t("{n} waiting to send", { n: queued })}` : ""}</span></div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>{live ? <button className="s" onClick={() => setShowQr(!showQr)} aria-expanded={showQr}>{showQr ? t("Hide QR code") : t("Show QR code for students")}</button> : <span className="pill">{t("QR check-in is available on the day of the class")}</span>}<button className="s" onClick={() => all("PRESENT")}>{t("All present")}</button><button className="s" onClick={() => all("ABSENT")}>{t("All absent")}</button>{queued > 0 && online && <button className="s" onClick={flush}>{t("Send now")}</button>}</div>
    {showQr && <div style={{ display: "grid", justifyItems: "center", gap: 6, padding: 12, border: "1px solid var(--line)", borderRadius: 14, marginBottom: 12, background: "#fff", color: "#0A2240" }} data-notranslate>
      {qr ? <div style={{ width: "min(320px,80vw)" }} dangerouslySetInnerHTML={{ __html: qr.svg }} aria-label={t("Attendance QR code")} role="img" /> : <p>{t("Checking...")}</p>}
      <b>{t("Scan with your phone camera to mark yourself present")}</b><small>{t("The code changes every 30 seconds.")} {qr ? `${qr.present} ${t("checked in")}` : ""}</small></div>}
    <div className="tbl"><table><thead><tr><th>{t("Student")}</th><th>{t("Status")}</th><th>{t("Attendance")}</th></tr></thead><tbody>
      {students.length === 0 && <tr><td colSpan={3} className="empty">{t("No enrolled students in this group yet.")}</td></tr>}
      {students.map((s) => <tr key={s.id}><td>{s.name}{s.method === "QR" && <small style={{ color: "var(--muted)", marginLeft: 6 }}>QR</small>}</td>
        <td><select aria-label={`${t("Status")}: ${s.name}`} value={marks[s.id]} onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value as St })}><option value="PRESENT">{t("Present")}</option><option value="LATE">{t("Late")}</option><option value="ABSENT">{t("Absent")}</option><option value="EXCUSED">{t("Excused")}</option></select></td>
        <td>{s.rate === null ? t("No records") : <span className={`pill ${s.rate < 80 ? "bad" : "ok"}`}>{s.rate}%</span>}</td></tr>)}</tbody></table></div>
    <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><button className="p" disabled={busy || students.length === 0} onClick={save}>{t("Save attendance")}</button>{msg && <span role="status" id="att-msg">{msg}</span>}</div></div>);
}
