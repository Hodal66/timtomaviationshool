"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export type GridSlot = { id: string; subject: string; dayOfWeek: number; startMin: number; endMin: number; lecturer: string; room: string };
const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** Weekly grid. Drag a class to another day or hour, or use the Move controls (keyboard and touch). Clashes are refused by the server. */
export function TimetableGrid({ slots, days, dayNames, canEdit, move, remove }: { slots: GridSlot[]; days: number[]; dayNames: string[]; canEdit: boolean; move: (id: string, day: number, startMin: number) => Promise<string | null>; remove: (id: string) => Promise<void> }) {
  const t = useT(); const router = useRouter(); const [err, setErr] = useState(""); const [drag, setDrag] = useState<string | null>(null); const [over, setOver] = useState(""); const [pending, start] = useTransition(); const [edit, setEdit] = useState<string | null>(null);
  const first = Math.min(8 * 60, ...slots.map((s) => Math.floor(s.startMin / 60) * 60)), last = Math.max(18 * 60, ...slots.map((s) => Math.ceil(s.endMin / 60) * 60)); const hours = Array.from({ length: (last - first) / 60 }, (_, i) => first + i * 60);
  const doMove = (id: string, day: number, startMin: number) => { setErr(""); start(async () => { const e = await move(id, day, startMin); if (e) setErr(e); setEdit(null); router.refresh(); }); };
  return (<div><div role="alert" className="err" style={{ minHeight: 22 }} id="tt-err">{err}</div>
    <div className="tt" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(150px, 1fr))` }} aria-busy={pending}>
      <div className="tt-h" />{days.map((d) => <div key={d} className="tt-h">{dayNames[d]}</div>)}
      {hours.map((h) => [<div key={"h" + h} className="tt-t">{hh(h)}</div>, ...days.map((d) => { const key = `${d}-${h}`; const here = slots.filter((s) => s.dayOfWeek === d && s.startMin >= h && s.startMin < h + 60);
        return (<div key={key} className={"tt-c" + (over === key ? " over" : "")} data-cell={key} onDragOver={(e) => { if (canEdit) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== key) setOver(key); } }} onDragLeave={() => setOver("")} onDrop={(e) => { e.preventDefault(); setOver(""); const id = e.dataTransfer.getData("text/plain") || drag; if (id) doMove(id, d, h); setDrag(null); }}>
          {here.map((s) => <div key={s.id} className="tt-s" draggable={canEdit} onDragStart={(e) => { e.dataTransfer.setData("text/plain", s.id); e.dataTransfer.effectAllowed = "move"; setDrag(s.id); }} onDragEnd={() => setDrag(null)} data-slot={s.id}>
            <b>{s.subject}</b><small>{hh(s.startMin)}–{hh(s.endMin)} · {s.room}</small><small>{s.lecturer}</small>
            {canEdit && (edit === s.id ? <form className="tt-m" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const [H, M] = String(f.get("time")).split(":").map(Number); doMove(s.id, Number(f.get("day")), H * 60 + M); }}>
              <select name="day" defaultValue={s.dayOfWeek} aria-label={t("Day")}>{days.map((x) => <option key={x} value={x}>{dayNames[x]}</option>)}</select><input name="time" type="time" defaultValue={hh(s.startMin)} aria-label={t("Start")} required /><button className="s" type="submit">{t("Move")}</button></form>
              : <span className="tt-a"><button className="s" onClick={() => setEdit(s.id)} aria-label={`${t("Move")}: ${s.subject}`}>{t("Move")}</button><button className="s danger" onClick={() => { if (confirm(t("Remove this class?"))) start(async () => { await remove(s.id); router.refresh(); }); }} aria-label={`${t("Remove")}: ${s.subject}`}>{t("Remove")}</button></span>)}
          </div>)}</div>); })])}
    </div></div>);
}
