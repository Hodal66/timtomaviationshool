"use client";
import { useRef, useState } from "react";
import type { Media, Kind } from "@/lib/cloudinary";

const TABS: { k: "all" | Kind; label: string }[] = [{ k: "all", label: "All" }, { k: "image", label: "Photos" }, { k: "video", label: "Videos" }, { k: "audio", label: "Audio" }, { k: "file", label: "Documents" }];
const size = (b: number) => (b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");

export function Gallery({ items, limit }: { items: Media[]; limit?: number }) {
  const [tab, setTab] = useState<"all" | Kind>("all"); const [open, setOpen] = useState<Media | null>(null); const dlg = useRef<HTMLDialogElement>(null);
  const count = (k: "all" | Kind) => (k === "all" ? items.length : items.filter((i) => i.kind === k).length);
  const shown = items.filter((i) => tab === "all" || i.kind === tab).slice(0, limit ?? 1000);
  const show = (m: Media) => { setOpen(m); dlg.current?.showModal(); };
  return (<div className="gal">
    <div className="gtabs" role="tablist" aria-label="Gallery categories">
      {TABS.filter((t) => t.k === "all" || count(t.k) > 0).map((t) => <button key={t.k} role="tab" aria-selected={tab === t.k} className={tab === t.k ? "on" : ""} onClick={() => setTab(t.k)}>{t.label}<span>{count(t.k)}</span></button>)}
    </div>
    <ul className="ggrid" role="tabpanel">
      {shown.map((m) => <li key={m.id} className={"g-" + m.kind}>
        {m.kind === "image" || m.kind === "video" ? <button className="gthumb" onClick={() => show(m)} aria-label={`${m.kind === "video" ? "Play video" : "View photo"}: ${m.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.thumb!} alt={m.name} loading="lazy" decoding="async" />{m.kind === "video" && <i className="gplay" aria-hidden>▶</i>}</button>
        : m.kind === "audio" ? <div className="gcard"><b aria-hidden>♪</b><span>{m.name}</span><audio controls preload="none" src={m.url} aria-label={m.name} /></div>
        : <a className="gcard" href={m.url} target="_blank" rel="noopener noreferrer"><b aria-hidden>▤</b><span>{m.name}</span><small>{m.format.toUpperCase()} · {size(m.bytes)} · Open</small></a>}
      </li>)}
    </ul>
    {shown.length === 0 && <p className="gempty">Nothing here yet.</p>}
    <dialog ref={dlg} className="glight" onClose={() => setOpen(null)} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }} aria-label={open?.name ?? "Preview"}>
      <button className="gx" onClick={() => dlg.current?.close()} aria-label="Close preview">×</button>
      {open?.kind === "image" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={open.url.replace("/upload/", "/upload/q_auto,f_auto,w_1600/")} alt={open.name} />}
      {open?.kind === "video" && <video src={open.url} controls autoPlay playsInline />}
    </dialog>
  </div>);
}
