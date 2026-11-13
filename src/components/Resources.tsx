"use client";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";

type Item = { id: string; title: string; description: string | null; programme: string; programmeId: string; module: string; topic: string | null; kind: string; licence: string; viewOnly: boolean; link: boolean; size: number | null; updated: string };
/** RES: the student's course resources: search, open in the browser, download, or a ZIP of a module. */
export function Resources() {
  const t = useT(); const [items, setItems] = useState<Item[] | null>(null); const [err, setErr] = useState(""); const [q, setQ] = useState("");
  useEffect(() => { fetch("/api/me/resources").then(async (r) => { const j = await r.json().catch(() => ({})); if (r.ok) setItems(j.items); else setErr(j.error ?? t("Something went wrong. Try again.")); }).catch(() => setErr(t("No connection. Try again."))); }, [t]);
  const groups = useMemo(() => { const g = new Map<string, Item[]>(); for (const i of items ?? []) { const s = q.trim().toLowerCase(); if (s && ![i.title, i.description, i.module, i.topic, i.kind].join(" ").toLowerCase().includes(s)) continue; const k = `${i.programmeId}|${i.module}`; g.set(k, [...(g.get(k) ?? []), i]); } return [...g.entries()]; }, [items, q]);
  if (err) return <div className="panel"><p className="err" role="alert">{err}</p></div>;
  if (!items) return <div className="panel"><p role="status">{t("Loading...")}</p></div>;
  if (!items.length) return <div className="panel empty">{t("Course resources appear here once you are enrolled and your lecturers publish them.")}</div>;
  return (<div className="panel" id="my-resources"><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><h2 style={{ margin: 0 }}>{t("Course resources")}</h2><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search resources")} aria-label={t("Search resources")} style={{ minWidth: 220 }} /></div>
    {groups.length === 0 && <p className="empty">{t("No resources match.")}</p>}
    {groups.map(([k, list]) => { const [pid, mod] = k.split("|"); return (<section key={k} style={{ marginTop: 14 }} data-module={mod}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><h3 style={{ margin: 0 }}>{mod} <small style={{ color: "var(--muted)", fontWeight: 400 }}>{list[0].programme}</small></h3>
      {list.some((i) => !i.viewOnly) && <a className="btn s" href={`/api/resources/zip?programmeId=${encodeURIComponent(pid)}&module=${encodeURIComponent(mod)}`} download>{t("Download all (ZIP)")}</a>}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8 }}>{list.map((i) => <li key={i.id} data-res={i.title} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{i.title}</b><span className="pill">{t(i.kind.charAt(0) + i.kind.slice(1).toLowerCase())}</span></div>
        {i.description && <p style={{ margin: "4px 0" }}>{i.description}</p>}<small style={{ color: "var(--muted)" }}>{[i.topic, i.licence, i.size ? `${Math.ceil(i.size / 1024)} KB` : null, `${t("Updated")} ${i.updated}`].filter(Boolean).join(" · ")}</small>
        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}><a className="btn s p" href={`/api/resources/${i.id}`} target="_blank" rel="noopener">{i.link ? t("Open link") : t("Open")}</a>{!i.viewOnly && !i.link && <a className="btn s" href={`/api/resources/${i.id}?dl=1`} download>{t("Download")}</a>}{i.viewOnly && <span className="pill warn">{t("View only")}</span>}</div></li>)}</ul></section>); })}</div>);
}
