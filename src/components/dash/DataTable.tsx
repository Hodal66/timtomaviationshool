"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "./icons";
import { useT } from "@/lib/i18n/client";

export type Col = { key: string; label: string; sortable?: boolean; filter?: boolean; hidden?: boolean; align?: "right" };
export type Row = { id: string; v: Record<string, string | number | null | undefined>; c?: Record<string, React.ReactNode> };
export type Bulk = { label: string; danger?: boolean; confirm?: string; run: (ids: string[]) => Promise<void> };
const norm = (x: unknown) => String(x ?? "").toLowerCase();
const csvCell = (x: unknown) => `"${String(x ?? "").replace(/"/g, '""')}"`;

export function DataTable({ id, cols, rows, exportName = "export", bulk, toolbar, empty }: { id: string; cols: Col[]; rows: Row[]; exportName?: string; bulk?: Bulk[]; toolbar?: React.ReactNode; empty?: string }) {
  const t = useT(); const [q, setQ] = useState(""); const [sort, setSort] = useState<{ k: string; d: 1 | -1 } | null>(null); const [page, setPage] = useState(1); const [size, setSize] = useState(10);
  const [hidden, setHidden] = useState<string[]>(cols.filter((c) => c.hidden).map((c) => c.key)); const [filters, setFilters] = useState<Record<string, string>>({}); const [colMenu, setColMenu] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set()); const [pending, start] = useTransition(); const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem("dt:" + id) ?? "null"); if (s) { if (Array.isArray(s.hidden)) setHidden(s.hidden); if (s.size) setSize(s.size); } } catch { /* ignore */ } }, [id]);
  useEffect(() => { try { localStorage.setItem("dt:" + id, JSON.stringify({ hidden, size })); } catch { /* ignore */ } }, [id, hidden, size]);
  useEffect(() => { const f = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setColMenu(false); }; document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f); }, []);
  const vis = cols.filter((c) => !hidden.includes(c.key));
  const options = useMemo(() => Object.fromEntries(cols.filter((c) => c.filter).map((c) => [c.key, [...new Set(rows.map((r) => String(r.v[c.key] ?? "")).filter(Boolean))].sort()])), [cols, rows]);
  const data = useMemo(() => {
    let r = rows; const s = norm(q).trim();
    if (s) r = r.filter((x) => vis.some((c) => norm(x.v[c.key]).includes(s)));
    for (const [k, v] of Object.entries(filters)) if (v) r = r.filter((x) => String(x.v[k] ?? "") === v);
    if (sort) r = [...r].sort((a, b) => { const x = a.v[sort.k], y = b.v[sort.k]; return (typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true })) * sort.d; });
    return r;
  }, [rows, q, filters, sort, hidden]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(data.length / size)); const cur = Math.min(page, pages); const slice = data.slice((cur - 1) * size, cur * size);
  useEffect(() => setPage(1), [q, filters, size]);
  const toggleSort = (k: string) => setSort((s) => (s?.k !== k ? { k, d: 1 } : s.d === 1 ? { k, d: -1 } : null));
  const allOn = slice.length > 0 && slice.every((r) => sel.has(r.id));
  const flip = (ids: string[], on: boolean) => setSel((p) => { const n = new Set(p); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n; });
  const download = () => {
    const head = vis.map((c) => csvCell(c.label)).join(","); const body = data.map((r) => vis.map((c) => csvCell(r.v[c.key])).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8" })); a.download = `${exportName}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const nums = (() => { const out: (number | "…")[] = []; for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - cur) <= 1) out.push(p); else if (out[out.length - 1] !== "…") out.push("…"); return out; })();
  return (<div>
    <div className="dt-bar">
      <div className="dt-search"><Icon n="search" size={16} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search")} aria-label={t("Search")} /></div>
      {cols.filter((c) => c.filter).map((c) => <select key={c.key} aria-label={c.label} value={filters[c.key] ?? ""} onChange={(e) => setFilters({ ...filters, [c.key]: e.target.value })}><option value="">{c.label}: {t("All")}</option>{options[c.key].map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
      <div className="menu" ref={menuRef}><button className="s" style={{ minHeight: 38, display: "flex", gap: 6, alignItems: "center" }} aria-expanded={colMenu} onClick={() => setColMenu(!colMenu)}><Icon n="cols" size={16} />{t("Columns")}</button>
        {colMenu && <div style={{ minWidth: 220 }}><div className="dt-cols">{cols.map((c) => <label key={c.key}><input className="dt-sel" type="checkbox" checked={!hidden.includes(c.key)} onChange={(e) => setHidden(e.target.checked ? hidden.filter((h) => h !== c.key) : [...hidden, c.key])} />{c.label}</label>)}</div></div>}</div>
      <button className="s" style={{ minHeight: 38, display: "flex", gap: 6, alignItems: "center" }} onClick={download}><Icon n="down" size={16} />{t("Download CSV")}</button>
      {toolbar}
    </div>
    {bulk && sel.size > 0 && <div className="bulk" role="region" aria-label={t("Selected rows")}>{t("{n} selected", { n: sel.size })}{bulk.map((b) => <button key={b.label} className={"s" + (b.danger ? " danger" : "")} disabled={pending} onClick={() => { if (b.confirm && !confirm(b.confirm)) return; start(async () => { await b.run([...sel]); setSel(new Set()); }); }}>{b.label}</button>)}<button className="s" onClick={() => setSel(new Set())}>{t("Clear")}</button></div>}
    <div className="tbl"><table><thead><tr>
      {bulk && <th style={{ width: 36 }}><input className="dt-sel" type="checkbox" aria-label={t("Select all on this page")} checked={allOn} onChange={(e) => flip(slice.map((r) => r.id), e.target.checked)} /></th>}
      {vis.map((c) => <th key={c.key} className={c.sortable !== false ? "sort" : ""} style={{ textAlign: c.align }} aria-sort={sort?.k === c.key ? (sort.d === 1 ? "ascending" : "descending") : undefined} onClick={() => c.sortable !== false && toggleSort(c.key)}>{c.label}{sort?.k === c.key ? (sort.d === 1 ? " ▲" : " ▼") : ""}</th>)}
    </tr></thead><tbody>
      {slice.map((r) => <tr key={r.id} aria-selected={sel.has(r.id)}>
        {bulk && <td><input className="dt-sel" type="checkbox" aria-label={t("Select row")} checked={sel.has(r.id)} onChange={(e) => flip([r.id], e.target.checked)} /></td>}
        {vis.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{r.c?.[c.key] ?? r.v[c.key] ?? ""}</td>)}</tr>)}
      {slice.length === 0 && <tr><td colSpan={vis.length + (bulk ? 1 : 0)} className="empty">{empty ?? t("Nothing to show.")}</td></tr>}
    </tbody></table></div>
    <div className="dt-foot"><span>{data.length ? t("Showing {a}–{b} of {n}", { a: (cur - 1) * size + 1, b: Math.min(cur * size, data.length), n: data.length }) : t("0 results")}</span>
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>{t("Rows per page")}<select value={size} onChange={(e) => setSize(Number(e.target.value))}>{[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
      <nav className="dt-pg" aria-label={t("Pages")}><button className="s" disabled={cur === 1} onClick={() => setPage(1)} aria-label={t("First page")}>«</button><button className="s" disabled={cur === 1} onClick={() => setPage(cur - 1)} aria-label={t("Previous page")}>‹</button>
        {nums.map((n, i) => (n === "…" ? <span key={i}>…</span> : <button key={n} className="s" aria-current={n === cur ? "page" : undefined} onClick={() => setPage(n)}>{n}</button>))}
        <button className="s" disabled={cur === pages} onClick={() => setPage(cur + 1)} aria-label={t("Next page")}>›</button><button className="s" disabled={cur === pages} onClick={() => setPage(pages)} aria-label={t("Last page")}>»</button></nav></div>
  </div>);
}
