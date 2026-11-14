"use client";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";

type Item = { id: string; title: string; description: string | null; programme: string; programmeId: string; module: string; topic: string | null; kind: string; licence: string; viewOnly: boolean; link: boolean; size: number | null; updated: string };
type Course = { programmeId: string; programme: string; modules: { name: string; topics: string[] }[]; announcements: { id: string; title: string; body: string; by: string; at: string }[] };
/** LMS-01 / RES: the student's course space: announcements, modules in syllabus order with their materials, search, open in the browser, download, ZIP for offline study. */
export function Resources() {
  const t = useT(); const [data, setData] = useState<{ items: Item[]; courses: Course[] } | null>(null); const [err, setErr] = useState(""); const [q, setQ] = useState("");
  useEffect(() => { fetch("/api/me/resources").then(async (r) => { const j = await r.json().catch(() => ({})); if (r.ok) setData({ items: j.items ?? [], courses: j.courses ?? [] }); else setErr(j.error ?? t("Something went wrong. Try again.")); }).catch(() => setErr(t("No connection. Try again."))); }, [t]);
  const s = q.trim().toLowerCase(); const match = useMemo(() => (i: Item) => !s || [i.title, i.description, i.module, i.topic, i.kind].join(" ").toLowerCase().includes(s), [s]);
  if (err) return <div className="panel"><p className="err" role="alert">{err}</p></div>;
  if (!data) return <div className="panel"><p role="status">{t("Loading...")}</p></div>;
  if (!data.courses.length) return <div className="panel empty">{t("Course resources appear here once you are enrolled and your lecturers publish them.")}</div>;
  return (<div style={{ display: "grid", gap: 16 }} id="my-resources">{data.courses.map((c) => { const mine = data.items.filter((i) => i.programmeId === c.programmeId); const names = [...c.modules.map((m) => m.name), ...[...new Set(mine.map((i) => i.module))].filter((m) => !c.modules.some((x) => x.name === m))];
    return (<div className="panel" key={c.programmeId} data-course={c.programme}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><h2 style={{ margin: 0 }}>{c.programme}</h2><span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search resources")} aria-label={t("Search resources")} style={{ minWidth: 200 }} />
        {mine.some((i) => !i.viewOnly) && <a className="btn s" href={`/api/resources/zip?programmeId=${encodeURIComponent(c.programmeId)}`} download>{t("Download the course for offline study (ZIP)")}</a>}</span></div>
      {c.announcements.length > 0 && <section style={{ marginTop: 12 }} aria-label={t("Announcements")}><h3 style={{ margin: "0 0 6px" }}>{t("Announcements")}</h3><ul className="tl">{c.announcements.map((n) => <li key={n.id} data-note={n.title}><b>{n.title}</b> <small style={{ color: "var(--muted)" }}>{n.at} · {n.by}</small><br /><span style={{ whiteSpace: "pre-wrap" }}>{n.body}</span></li>)}</ul></section>}
      {mine.length === 0 && c.modules.length === 0 && <p className="empty">{t("Your lecturers have not published materials yet.")}</p>}
      {names.map((mod) => { const list = mine.filter((i) => i.module === mod && match(i)); const sy = c.modules.find((m) => m.name === mod); if (s && !list.length) return null;
        return (<section key={mod} style={{ marginTop: 14 }} data-module={mod}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><h3 style={{ margin: 0 }}>{mod}</h3>
          {list.some((i) => !i.viewOnly) && <a className="btn s" href={`/api/resources/zip?programmeId=${encodeURIComponent(c.programmeId)}&module=${encodeURIComponent(mod)}`} download>{t("Download all (ZIP)")}</a>}</div>
          {sy && sy.topics.length > 0 && <small style={{ color: "var(--muted)" }}>{t("Lessons")}: {sy.topics.join(" · ")}</small>}
          {list.length === 0 ? <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>{t("No materials for this module yet.")}</p> : <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8 }}>{list.map((i) => <li key={i.id} data-res={i.title} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{i.title}</b><span className="pill">{t(i.kind.charAt(0) + i.kind.slice(1).toLowerCase())}</span></div>
            {i.description && <p style={{ margin: "4px 0" }}>{i.description}</p>}<small style={{ color: "var(--muted)" }}>{[i.topic, i.licence, i.size ? `${Math.ceil(i.size / 1024)} KB` : null, `${t("Updated")} ${i.updated}`].filter(Boolean).join(" · ")}</small>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}><a className="btn s p" href={`/api/resources/${i.id}`} target="_blank" rel="noopener">{i.link ? t("Open link") : t("Open")}</a>{!i.viewOnly && !i.link && <a className="btn s" href={`/api/resources/${i.id}?dl=1`} download>{t("Download")}</a>}{i.viewOnly && <span className="pill warn">{t("View only")}</span>}</div></li>)}</ul>}</section>); })}</div>); })}</div>);
}
