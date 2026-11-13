"use client";
import { useState } from "react";
export function IdMark({ token }: { token: string }) {
  const [msg, setMsg] = useState(""); const [ok, setOk] = useState(false);
  return (<><button className="p" disabled={ok} onClick={async () => { const r = await fetch(`/api/id/${encodeURIComponent(token)}/mark`, { method: "POST" }); const j = await r.json().catch(() => ({})); setOk(!!j.ok); setMsg(j.ok ? `Marked ${j.status === "LATE" ? "late" : "present"} for ${j.subject}.` : j.error ?? "Could not mark attendance."); }}>Mark present in my class</button>{msg && <p role="status" className={ok ? "ok" : "err"} id="idmark-msg">{msg}</p>}</>);
}
