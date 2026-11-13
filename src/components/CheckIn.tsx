"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
export function CheckIn({ s, c }: { s: string; c: string }) {
  const t = useT(); const [st, setSt] = useState<{ ok?: boolean; msg: string; sub?: string } | null>(null);
  useEffect(() => { fetch("/api/attendance/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ s, c }) }).then(async (r) => { const j = await r.json().catch(() => ({}));
    setSt(j.ok ? { ok: true, msg: j.status === "LATE" ? t("You are marked late.") : t("You are marked present."), sub: `${j.name} · ${j.subject} · ${j.group}` } : { ok: false, msg: j.error ?? t("Something went wrong. Try again.") }); }).catch(() => setSt({ ok: false, msg: t("Network problem. Check your connection and try again.") })); }, [s, c]); // eslint-disable-line react-hooks/exhaustive-deps
  return (<div role="status" aria-live="polite" style={{ textAlign: "center", display: "grid", gap: 10 }}><h1 style={{ fontSize: "1.4rem" }}>{t("Class check-in")}</h1>
    {!st ? <p>{t("Checking...")}</p> : <><div style={{ fontSize: 54 }} aria-hidden>{st.ok ? "✓" : "!"}</div><p className={st.ok ? "ok" : "err"} style={{ fontSize: "1.15rem", fontWeight: 600 }} id="checkin-result">{st.msg}</p>{st.sub && <p>{st.sub}</p>}<a href="/me">{t("My dashboard")}</a></>}</div>);
}
