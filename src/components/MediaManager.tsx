"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Media } from "@/lib/cloudinary";
import { DataTable, type Col, type Row } from "@/components/dash/DataTable";
import { useT } from "@/lib/i18n/client";

const MAX = 100 * 1024 * 1024; type Job = { name: string; pct: number; err?: string; done?: boolean };
export function MediaManager({ initial }: { initial: Media[] }) {
  const t = useT(); const [jobs, setJobs] = useState<Job[]>([]); const [drag, setDrag] = useState(false); const input = useRef<HTMLInputElement>(null); const router = useRouter();
  const patch = (i: number, p: Partial<Job>) => setJobs((j) => j.map((x, n) => (n === i ? { ...x, ...p } : x)));
  async function upload(files: File[]) {
    const base = jobs.length; setJobs((j) => [...j, ...files.map((f) => ({ name: f.name, pct: 0 }))]);
    await Promise.all(files.map(async (f, n) => { const i = base + n;
      if (f.size > MAX) return patch(i, { err: "Larger than 100 MB." });
      try {
        const s = await (await fetch("/api/media/sign", { method: "POST" })).json(); if (!s.signature) throw new Error(s.error ?? "Not allowed");
        const fd = new FormData(); fd.append("file", f); fd.append("api_key", s.apiKey); fd.append("timestamp", String(s.timestamp)); fd.append("signature", s.signature); fd.append("folder", s.folder); fd.append("asset_folder", s.folder);
        await new Promise<void>((ok, bad) => { const x = new XMLHttpRequest(); x.open("POST", `https://api.cloudinary.com/v1_1/${s.cloud}/auto/upload`);
          x.upload.onprogress = (e) => e.lengthComputable && patch(i, { pct: Math.round((e.loaded / e.total) * 100) });
          x.onload = () => (x.status < 300 ? ok() : bad(new Error(JSON.parse(x.responseText || "{}").error?.message ?? "Upload failed"))); x.onerror = () => bad(new Error("Network error")); x.send(fd); });
        patch(i, { pct: 100, done: true });
      } catch (e) { patch(i, { err: (e as Error).message }); }
    }));
    await fetch("/api/media/refresh", { method: "POST" }); router.refresh();
  }
  async function del(m: Media) { if (!confirm(`Delete ${m.name}?`)) return; await fetch("/api/media/delete", { method: "POST", body: JSON.stringify({ id: m.id }), headers: { "content-type": "application/json" } }); router.refresh(); }
  const cols: Col[] = [{ key: "name", label: t("File") }, { key: "kind", label: t("Type"), filter: true }, { key: "size", label: t("Size"), align: "right" }, { key: "at", label: t("Added") }, { key: "act", label: "", sortable: false }];
  const rows: Row[] = initial.map((m) => ({ id: m.id, v: { name: m.name, kind: m.kind, size: Number((m.bytes / 1e6).toFixed(2)), at: m.at.slice(0, 10) }, c: { name: <>{m.thumb ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.thumb} alt="" width={48} height={34} style={{ objectFit: "cover", borderRadius: 6, verticalAlign: "middle", marginRight: 8 }} /> : null}<a href={m.url} target="_blank" rel="noopener noreferrer">{m.name}</a></>, size: `${(m.bytes / 1e6).toFixed(2)} MB`,
    act: <span style={{ display: "flex", gap: 6 }}><a className="s" style={{ padding: "4px 10px", border: "1px solid var(--line)", borderRadius: 10, textDecoration: "none" }} href={m.url} download target="_blank" rel="noopener noreferrer">{t("Download")}</a><button className="s danger" onClick={() => del(m)}>{t("Delete")}</button></span> } }));
  return (<>
    <div className={"drop" + (drag ? " on" : "")} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload([...e.dataTransfer.files]); }}>
      <p><b>Drag files here</b> or</p>
      <button className="p" type="button" onClick={() => input.current?.click()}>Choose files</button>
      <input ref={input} type="file" multiple hidden aria-label="Choose files to upload" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
      <small>Photos, videos, audio and documents, up to 100 MB each. They are sorted into the right tab automatically.</small>
    </div>
    {jobs.length > 0 && <ul className="jobs" aria-live="polite">{jobs.map((j, i) => <li key={i}><span>{j.name}</span>{j.err ? <em className="err">{j.err}</em> : <progress value={j.pct} max={100} aria-label={`Uploading ${j.name}`} />}{j.done && <b>Done</b>}</li>)}</ul>}
    <div className="panel" style={{ marginTop: 16 }}><DataTable id="media" exportName="media" empty={t("Nothing uploaded yet.")} cols={cols} rows={rows} bulk={[{ label: t("Delete"), danger: true, confirm: t("Delete the selected files?"), run: async (ids) => { for (const id of ids) await fetch("/api/media/delete", { method: "POST", body: JSON.stringify({ id }), headers: { "content-type": "application/json" } }); await fetch("/api/media/refresh", { method: "POST" }); router.refresh(); } }]} /></div></>);
}
