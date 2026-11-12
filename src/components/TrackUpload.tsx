"use client";
import { useState } from "react";

/** Upload a missing document after applying. Authorised by the application reference plus the applicant's phone or email. */
export function TrackUpload({ kind, reference, who }: { kind: string; reference: string; who: string }) {
  const [s, setS] = useState<"idle" | "busy" | "ok" | "err">("idle"); const [m, setM] = useState("");
  async function go(f?: File) {
    if (!f) return; setS("busy"); setM("");
    const fd = new FormData(); fd.set("kind", kind); fd.set("reference", reference); fd.set("who", who); fd.set("file", f);
    const r = await fetch("/api/apply/upload", { method: "POST", body: fd }).catch(() => null); const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setS("ok"); else { setS("err"); setM(j.error || "Upload failed. Check your connection."); }
  }
  const id = `tu-${kind.replace(/\W+/g, "-")}`;
  return (<span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    <input id={id} type="file" accept="image/*,application/pdf" className="sr" onChange={(e) => go(e.target.files?.[0])} disabled={s === "busy"} />
    <label htmlFor={id} className="btn ghost sm" role="button">{s === "busy" ? "Uploading..." : s === "ok" ? "Replace file" : "Upload file"}</label>
    {s === "ok" && <span className="pillx ok" role="status">Received</span>}{s === "err" && <span role="alert" style={{ color: "var(--bad)", fontSize: ".88rem" }}>{m}</span>}</span>);
}
