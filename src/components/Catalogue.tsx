"use client";
import { useEffect, useMemo, useState } from "react";
import { CourseCard, type CardCourse } from "./CourseCard";

type C = CardCourse & { areaId: string };
export function Catalogue({ courses, areas }: { courses: C[]; areas: { id: string; label: string; count: number }[] }) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState("all");
  const [ready, setReady] = useState(false);
  useEffect(() => { // read filters from the link after load so the page itself can be cached
    const u = new URL(location.href), a = u.searchParams.get("area") ?? "all";
    setQ(u.searchParams.get("q") ?? ""); setArea(areas.some((x) => x.id === a) ? a : "all"); setReady(true);
  }, [areas]);
  useEffect(() => {
    if (!ready) return;
    const u = new URL(location.href); q ? u.searchParams.set("q", q) : u.searchParams.delete("q"); area !== "all" ? u.searchParams.set("area", area) : u.searchParams.delete("area");
    history.replaceState(null, "", u);
  }, [q, area, ready]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return courses.filter((c) => (area === "all" || c.areaId === area) && (!t || `${c.name} ${c.summary ?? ""} ${c.areaLabel}`.toLowerCase().includes(t)));
  }, [courses, q, area]);
  return (<>
    <div className="tools">
      <div className="search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
        <label className="sr" htmlFor="cq">Search programmes</label><input id="cq" type="search" placeholder="Search programmes, for example cabin crew" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></div>
      <div className="chips" role="group" aria-label="Filter by subject area">
        <button className="chip" aria-pressed={area === "all"} onClick={() => setArea("all")}>All<small>{courses.length}</small></button>
        {areas.map((a) => <button key={a.id} className="chip" aria-pressed={area === a.id} onClick={() => setArea(a.id)}>{a.label}<small>{a.count}</small></button>)}
      </div>
    </div>
    <p className="count" role="status" aria-live="polite">{list.length === 1 ? "1 programme" : `${list.length} programmes`}</p>
    {list.length === 0 ? <div className="empty"><b>No programmes match your search.</b><br />Try a different word or clear the filter.<p style={{ marginTop: 16 }}><button className="btn ghost sm" onClick={() => { setQ(""); setArea("all"); }}>Clear search</button></p></div> :
      <div className="cgrid2">{list.map((c, i) => <CourseCard key={c.id} c={c} priority={i < 3} />)}</div>}
  </>);
}
