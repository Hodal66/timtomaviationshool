import { db } from "@/lib/db";
import { GROUPS } from "@/lib/groups";
import { Track } from "@/components/Track";
export const revalidate = 60;
export const metadata = { title: "Courses · Timtom Aviation School" };

export default async function Courses() {
  const courses = await db.programme.findMany({ where: { status: "PUBLISHED" }, orderBy: { code: "asc" }, include: { offerings: { where: { status: "OPEN" }, select: { id: true } } } });
  courses.sort((a, b) => (Number(a.code.replace(/\D/g, "")) || 999) - (Number(b.code.replace(/\D/g, "")) || 999));
  return (<div className="wrap sec"><Track /><h1>Courses</h1><span className="rule" />
    {courses.length === 0 && <p className="notice">No courses are published yet. Please check back soon.</p>}
    {GROUPS.map((g) => { const list = courses.filter(g.test); if (!list.length) return null;
      return (<section key={g.id} id={g.id} style={{ marginTop: 28, scrollMarginTop: 110 }}><h2>{g.title}</h2>
        <div className="grid3">{list.map((c) => (<a key={c.id} href={`/courses/${c.slug}`} className="tile link"><h3>{c.name}</h3><p style={{ margin: "0 0 8px", color: "var(--muted)" }}>{c.summary}</p>
          {c.feeRwf != null && <b>{c.feeRwf.toLocaleString("en-US")} Rwf</b>} {c.durationMonths && <span className="tag">{c.durationMonths} months</span>} <span className={`pill ${c.offerings.length ? "ok" : "warn"}`}>{c.offerings.length ? "Applications open" : "No open intake"}</span></a>))}</div></section>); })}
  </div>);
}
